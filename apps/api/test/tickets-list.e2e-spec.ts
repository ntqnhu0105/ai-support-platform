import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Priority, TicketStatus } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { formatTicketCode } from '../src/tickets/ticket.mapper.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

type SeedOptions = Partial<{
  subject: string;
  body: string;
  status: TicketStatus;
  priority: Priority;
  assigneeId: string;
  createdAt: Date;
}>;

describe('Ticket list (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let otherCustomer: TestUser;
  let agent: TestUser;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const list = (token: string | undefined, params: Record<string, string | number> = {}) => {
    const req = request(app.getHttpServer()).get('/tickets').query(params);
    return token ? req.set(bearer(token)) : req;
  };
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0));
  const seed = (customerId: string, options: SeedOptions = {}) =>
    prisma.ticket.create({
      data: {
        subject: 'Payment issue',
        body: 'Something went wrong with my payment.',
        customerId,
        ...options,
      },
    });
  const subjects = (res: request.Response): string[] =>
    res.body.items.map((t: { subject: string }) => t.subject);
  const ids = (res: request.Response): string[] =>
    res.body.items.map((t: { id: string }) => t.id);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    customer = await createUser(app, prisma, { email: 'customer@example.com' });
    otherCustomer = await createUser(app, prisma, { email: 'other@example.com' });
    agent = await createUser(app, prisma, { email: 'agent@example.com', role: 'AGENT' });
  });

  it('rejects a request without a token (401)', async () => {
    await list(undefined).expect(401);
  });

  describe('access scope', () => {
    it('shows a customer only their own tickets', async () => {
      await seed(customer.id);
      await seed(customer.id);
      await seed(otherCustomer.id);

      const res = await list(customer.token).expect(200);

      expect(res.body.meta.total).toBe(2);
      for (const ticket of res.body.items) {
        expect(ticket.customerId).toBe(customer.id);
      }
    });

    it('shows an agent the tickets of every customer', async () => {
      await seed(customer.id);
      await seed(customer.id);
      await seed(otherCustomer.id);

      const res = await list(agent.token).expect(200);
      expect(res.body.meta.total).toBe(3);
    });

    it('rejects a client-supplied customerId filter (400)', async () => {
      await list(customer.token, { customerId: otherCustomer.id }).expect(400);
    });
  });

  describe('pagination', () => {
    it('splits results into pages without gaps or duplicates, even when timestamps tie', async () => {
      const sameTime = at(0);
      await prisma.ticket.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          subject: `Ticket number ${i}`,
          body: 'Body text for a seeded ticket.',
          customerId: customer.id,
          createdAt: sameTime,
        })),
      });

      const page1 = await list(agent.token, { page: 1, pageSize: 10 }).expect(200);
      const page2 = await list(agent.token, { page: 2, pageSize: 10 }).expect(200);
      const page3 = await list(agent.token, { page: 3, pageSize: 10 }).expect(200);

      expect(page1.body.items).toHaveLength(10);
      expect(page2.body.items).toHaveLength(10);
      expect(page3.body.items).toHaveLength(5);
      expect(page1.body.meta).toEqual({ page: 1, pageSize: 10, total: 25, totalPages: 3 });

      const all = [...ids(page1), ...ids(page2), ...ids(page3)];
      expect(new Set(all).size).toBe(25);
    });

    it('uses 20 items per page by default', async () => {
      await prisma.ticket.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          subject: `Ticket number ${i}`,
          body: 'Body text for a seeded ticket.',
          customerId: customer.id,
          createdAt: at(i),
        })),
      });

      const res = await list(agent.token).expect(200);

      expect(res.body.items).toHaveLength(20);
      expect(res.body.meta.pageSize).toBe(20);
    });

    it('returns an empty page beyond the last page', async () => {
      await seed(customer.id);

      const res = await list(agent.token, { page: 5 }).expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(1);
    });

        const invalidPagination: Record<string, string | number>[] = [
      { page: 0 },
      { page: 'abc' },
      { pageSize: 0 },
      { pageSize: 51 },
    ];

    it.each(invalidPagination)('rejects invalid pagination %j (400)', async (params) => {
      await list(agent.token, params).expect(400);
    });
  });

  describe('ordering', () => {
    beforeEach(async () => {
      await seed(customer.id, { subject: 'A', createdAt: at(1) });
      await seed(customer.id, { subject: 'B', createdAt: at(2) });
      await seed(customer.id, { subject: 'C', createdAt: at(3) });
    });

    it('lists the newest tickets first by default', async () => {
      const res = await list(agent.token).expect(200);
      expect(subjects(res)).toEqual(['C', 'B', 'A']);
    });

    it('lists the oldest tickets first with sort=oldest', async () => {
      const res = await list(agent.token, { sort: 'oldest' }).expect(200);
      expect(subjects(res)).toEqual(['A', 'B', 'C']);
    });

    it('puts urgent tickets first and the oldest first within the same priority', async () => {
      await resetDatabase(prisma);
      customer = await createUser(app, prisma, { email: 'customer@example.com' });
      agent = await createUser(app, prisma, { email: 'agent@example.com', role: 'AGENT' });

      await seed(customer.id, { subject: 'low', priority: 'LOW', createdAt: at(1) });
      await seed(customer.id, { subject: 'urgent-old', priority: 'URGENT', createdAt: at(2) });
      await seed(customer.id, { subject: 'medium', priority: 'MEDIUM', createdAt: at(3) });
      await seed(customer.id, { subject: 'high', priority: 'HIGH', createdAt: at(4) });
      await seed(customer.id, { subject: 'urgent-new', priority: 'URGENT', createdAt: at(5) });

      const res = await list(agent.token, { sort: 'priority' }).expect(200);

      expect(subjects(res)).toEqual(['urgent-old', 'urgent-new', 'high', 'medium', 'low']);
    });
  });

  describe('filters', () => {
    it('filters by status', async () => {
      await seed(customer.id, { status: 'OPEN' });
      await seed(customer.id, { status: 'IN_PROGRESS' });
      await seed(customer.id, { status: 'RESOLVED' });

      const res = await list(agent.token, { status: 'IN_PROGRESS' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].status).toBe('IN_PROGRESS');
    });

    it('filters by priority', async () => {
      await seed(customer.id, { priority: 'LOW' });
      await seed(customer.id, { priority: 'URGENT' });

      const res = await list(agent.token, { priority: 'URGENT' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].priority).toBe('URGENT');
    });

    it('filters by assignee', async () => {
      await seed(customer.id, { assigneeId: agent.id });
      await seed(customer.id);

      const res = await list(agent.token, { assigneeId: agent.id }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].assigneeId).toBe(agent.id);
    });

    it('combines filters with the access scope instead of widening it', async () => {
      await seed(customer.id, { status: 'OPEN' });
      await seed(customer.id, { status: 'RESOLVED' });
      await seed(otherCustomer.id, { status: 'OPEN' });

      const res = await list(customer.token, { status: 'OPEN' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].customerId).toBe(customer.id);
    });

    it('rejects an unknown status (400)', async () => {
      await list(agent.token, { status: 'DONE' }).expect(400);
    });
  });

  describe('search', () => {
    it('matches the subject ignoring letter case', async () => {
      await seed(customer.id, { subject: 'Cannot withdraw money' });
      await seed(customer.id, { subject: 'Card declined' });

      const res = await list(agent.token, { q: 'WITHDRAW' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].subject).toBe('Cannot withdraw money');
    });

    it('matches the body', async () => {
      await seed(customer.id, { subject: 'App problem', body: 'The app crashes when I open settings' });
      await seed(customer.id, { subject: 'Other problem' });

      const res = await list(agent.token, { q: 'crashes' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].subject).toBe('App problem');
    });

    it('matches a ticket code in any letter case', async () => {
      const target = await seed(customer.id);
      await seed(customer.id);

      const res = await list(agent.token, {
        q: formatTicketCode(target.number).toLowerCase(),
      }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].id).toBe(target.id);
    });

    it('returns an empty result when nothing matches', async () => {
      await seed(customer.id);

      const res = await list(agent.token, { q: 'zzzzzz' }).expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it("never leaks another customer's tickets through search", async () => {
      await seed(customer.id, { subject: 'My refund is late' });
      await seed(otherCustomer.id, { subject: 'Secret refund dispute' });

      const res = await list(customer.token, { q: 'refund' }).expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].customerId).toBe(customer.id);
    });
  });

  describe('response shape', () => {
    it('returns summaries without the ticket body', async () => {
      await seed(customer.id);

      const res = await list(agent.token).expect(200);

      expect(res.body.items[0]).not.toHaveProperty('body');
      expect(res.body.items[0].code).toMatch(/^TCK-\d{4,}$/);
    });
  });
});