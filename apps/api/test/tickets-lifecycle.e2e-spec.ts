import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { TicketStatus } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

const NO_SUCH_ID = '00000000-0000-4000-8000-000000000000';

describe('Ticket lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let agent: TestUser;
  let otherAgent: TestUser;
  let admin: TestUser;

  const send = (
    method: 'get' | 'post' | 'patch',
    path: string,
    token: string | undefined,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())[method](path);
    if (token) req.set({ Authorization: `Bearer ${token}` });
    return body ? req.send(body) : req;
  };
  const changeStatus = (id: string, token: string | undefined, status: string) =>
    send('patch', `/tickets/${id}/status`, token, { status });
  const assign = (id: string, token: string | undefined, body: object = {}) =>
    send('post', `/tickets/${id}/assign`, token, body);
  const unassign = (id: string, token: string | undefined) =>
    send('post', `/tickets/${id}/unassign`, token, {});
  const history = (id: string, token: string | undefined) =>
    send('get', `/tickets/${id}/history`, token);

  const seed = (options: { status?: TicketStatus; assigneeId?: string } = {}) =>
    prisma.ticket.create({
      data: {
        subject: 'Payment issue',
        body: 'Something went wrong with my payment.',
        customerId: customer.id,
        ...options,
      },
    });
  const dbTicket = (id: string) => prisma.ticket.findUniqueOrThrow({ where: { id } });
  const auditFor = (id: string) =>
    prisma.auditLog.findMany({
      where: { entity: 'ticket', entityId: id },
      orderBy: { createdAt: 'asc' },
    });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    customer = await createUser(app, prisma, { email: 'customer@example.com' });
    agent = await createUser(app, prisma, { email: 'agent@example.com', role: 'AGENT' });
    otherAgent = await createUser(app, prisma, { email: 'agent2@example.com', role: 'AGENT' });
    admin = await createUser(app, prisma, { email: 'admin@example.com', role: 'ADMIN' });
  });

  describe('PATCH /tickets/:id/status', () => {
    it('rejects a request without a token (401)', async () => {
      const ticket = await seed();
      await changeStatus(ticket.id, undefined, 'IN_PROGRESS').expect(401);
    });

    it('forbids a customer from changing status (403) and leaves the ticket untouched', async () => {
      const ticket = await seed();

      await changeStatus(ticket.id, customer.token, 'CLOSED').expect(403);

      expect((await dbTicket(ticket.id)).status).toBe('OPEN');
    });

    it('lets an agent move OPEN to IN_PROGRESS', async () => {
      const ticket = await seed();

      const res = await changeStatus(ticket.id, agent.token, 'IN_PROGRESS').expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect((await dbTicket(ticket.id)).status).toBe('IN_PROGRESS');
    });

    it('rejects a jump that skips a step (OPEN to RESOLVED) with 409', async () => {
      const ticket = await seed();

      await changeStatus(ticket.id, agent.token, 'RESOLVED').expect(409);

      expect((await dbTicket(ticket.id)).status).toBe('OPEN');
    });

    it('never reopens a CLOSED ticket (409)', async () => {
      const ticket = await seed({ status: 'CLOSED' });

      await changeStatus(ticket.id, admin.token, 'OPEN').expect(409);

      expect((await dbTicket(ticket.id)).status).toBe('CLOSED');
    });

    it('rejects setting the status the ticket already has (409)', async () => {
      const ticket = await seed({ status: 'IN_PROGRESS' });
      await changeStatus(ticket.id, agent.token, 'IN_PROGRESS').expect(409);
    });

    it('walks a ticket through its whole lifecycle', async () => {
      const ticket = await seed();

      for (const status of ['IN_PROGRESS', 'WAITING_CUSTOMER', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) {
        const res = await changeStatus(ticket.id, agent.token, status).expect(200);
        expect(res.body.status).toBe(status);
      }
    });

    it('rejects a status value that does not exist (400)', async () => {
      const ticket = await seed();
      await changeStatus(ticket.id, agent.token, 'DONE').expect(400);
    });

    it('returns 404 for a ticket that does not exist', async () => {
      await changeStatus(NO_SUCH_ID, agent.token, 'IN_PROGRESS').expect(404);
    });

    it('rejects an id that is not a UUID (400)', async () => {
      await changeStatus('abc', agent.token, 'IN_PROGRESS').expect(400);
    });

    it('records who changed the status, from what and to what', async () => {
      const ticket = await seed();

      await changeStatus(ticket.id, agent.token, 'IN_PROGRESS').expect(200);

      const entries = await auditFor(ticket.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'ticket.status_changed',
        actorId: agent.id,
        diff: { status: { from: 'OPEN', to: 'IN_PROGRESS' } },
      });
    });

    it('writes no audit entry when the change is refused', async () => {
      const ticket = await seed();

      await changeStatus(ticket.id, agent.token, 'RESOLVED').expect(409);

      expect(await auditFor(ticket.id)).toHaveLength(0);
    });
  });

  describe('POST /tickets/:id/assign', () => {
    it('rejects a request without a token (401)', async () => {
      const ticket = await seed();
      await assign(ticket.id, undefined).expect(401);
    });

    it('forbids a customer (403)', async () => {
      const ticket = await seed();
      await assign(ticket.id, customer.token).expect(403);
    });

    it('lets an agent claim an unassigned ticket by sending no assignee', async () => {
      const ticket = await seed();

      const res = await assign(ticket.id, agent.token).expect(200);

      expect(res.body.assigneeId).toBe(agent.id);
      expect((await dbTicket(ticket.id)).assigneeId).toBe(agent.id);
    });

    it('stops an agent from assigning a ticket to someone else (403)', async () => {
      const ticket = await seed();

      await assign(ticket.id, agent.token, { assigneeId: otherAgent.id }).expect(403);

      expect((await dbTicket(ticket.id)).assigneeId).toBeNull();
    });

    it('stops an agent from taking a ticket that belongs to another agent (409)', async () => {
      const ticket = await seed({ assigneeId: otherAgent.id });

      await assign(ticket.id, agent.token).expect(409);

      expect((await dbTicket(ticket.id)).assigneeId).toBe(otherAgent.id);
    });

    it('lets an admin assign a ticket to an agent', async () => {
      const ticket = await seed();

      const res = await assign(ticket.id, admin.token, { assigneeId: agent.id }).expect(200);

      expect(res.body.assigneeId).toBe(agent.id);
    });

    it('lets an admin reassign a ticket that is already assigned', async () => {
      const ticket = await seed({ assigneeId: otherAgent.id });

      await assign(ticket.id, admin.token, { assigneeId: agent.id }).expect(200);

      expect((await dbTicket(ticket.id)).assigneeId).toBe(agent.id);
    });

    it('refuses to assign a ticket to a customer (400)', async () => {
      const ticket = await seed();

      await assign(ticket.id, admin.token, { assigneeId: customer.id }).expect(400);

      expect((await dbTicket(ticket.id)).assigneeId).toBeNull();
    });

    it('refuses to assign a ticket to a user that does not exist (400)', async () => {
      const ticket = await seed();
      await assign(ticket.id, admin.token, { assigneeId: NO_SUCH_ID }).expect(400);
    });

    it('refuses to assign a CLOSED ticket (409)', async () => {
      const ticket = await seed({ status: 'CLOSED' });
      await assign(ticket.id, agent.token).expect(409);
    });

    it('is idempotent: assigning the same person twice records one audit entry', async () => {
      const ticket = await seed();

      await assign(ticket.id, agent.token).expect(200);
      await assign(ticket.id, agent.token).expect(200);

      expect(await auditFor(ticket.id)).toHaveLength(1);
    });

    it('rejects an assigneeId that is not a UUID (400)', async () => {
      const ticket = await seed();
      await assign(ticket.id, admin.token, { assigneeId: 'abc' }).expect(400);
    });

    it('records the assignment in the audit log', async () => {
      const ticket = await seed();

      await assign(ticket.id, agent.token).expect(200);

      const entries = await auditFor(ticket.id);
      expect(entries[0]).toMatchObject({
        action: 'ticket.assigned',
        actorId: agent.id,
        diff: { assigneeId: { from: null, to: agent.id } },
      });
    });
  });

  describe('POST /tickets/:id/unassign', () => {
    it('forbids a customer (403)', async () => {
      const ticket = await seed({ assigneeId: agent.id });
      await unassign(ticket.id, customer.token).expect(403);
    });

    it('lets an agent release their own ticket', async () => {
      const ticket = await seed({ assigneeId: agent.id });

      const res = await unassign(ticket.id, agent.token).expect(200);

      expect(res.body.assigneeId).toBeNull();
      expect((await dbTicket(ticket.id)).assigneeId).toBeNull();
    });

    it("stops an agent from releasing another agent's ticket (403)", async () => {
      const ticket = await seed({ assigneeId: otherAgent.id });

      await unassign(ticket.id, agent.token).expect(403);

      expect((await dbTicket(ticket.id)).assigneeId).toBe(otherAgent.id);
    });

    it('lets an admin release any ticket', async () => {
      const ticket = await seed({ assigneeId: otherAgent.id });

      await unassign(ticket.id, admin.token).expect(200);

      expect((await dbTicket(ticket.id)).assigneeId).toBeNull();
    });

    it('does nothing (200) when the ticket has no assignee', async () => {
      const ticket = await seed();

      await unassign(ticket.id, agent.token).expect(200);

      expect(await auditFor(ticket.id)).toHaveLength(0);
    });

    it('refuses to change a CLOSED ticket (409)', async () => {
      const ticket = await seed({ status: 'CLOSED', assigneeId: agent.id });

      await unassign(ticket.id, agent.token).expect(409);

      expect((await dbTicket(ticket.id)).assigneeId).toBe(agent.id);
    });
  });

  describe('GET /tickets/:id/history', () => {
    it('rejects a request without a token (401)', async () => {
      const ticket = await seed();
      await history(ticket.id, undefined).expect(401);
    });

    it('forbids a customer, even for their own ticket (403)', async () => {
      const ticket = await seed();
      await history(ticket.id, customer.token).expect(403);
    });

    it('returns 404 for a ticket that does not exist', async () => {
      await history(NO_SUCH_ID, agent.token).expect(404);
    });

    it('lists every change in chronological order, starting with the creation', async () => {
      const created = await send('post', '/tickets', customer.token, {
        subject: 'Cannot withdraw money',
        body: 'My withdrawal has been pending for three days.',
      }).expect(201);
      const id = created.body.id as string;

      await assign(id, agent.token).expect(200);
      await changeStatus(id, agent.token, 'IN_PROGRESS').expect(200);

      const res = await history(id, agent.token).expect(200);

      expect(res.body.map((entry: { action: string }) => entry.action)).toEqual([
        'ticket.created',
        'ticket.assigned',
        'ticket.status_changed',
      ]);
      expect(res.body[0].actorId).toBe(customer.id);
    });
  });
});