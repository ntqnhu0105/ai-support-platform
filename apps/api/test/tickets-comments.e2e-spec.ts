import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { TicketStatus } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

const NO_SUCH_ID = '00000000-0000-4000-8000-000000000000';

describe('Ticket comments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let otherCustomer: TestUser;
  let agent: TestUser;

  const send = (
    method: 'get' | 'post',
    path: string,
    token: string | undefined,
    body?: object,
  ) => {
    const req = request(app.getHttpServer())[method](path);
    if (token) req.set({ Authorization: `Bearer ${token}` });
    return body ? req.send(body) : req;
  };
  const postComment = (ticketId: string, token: string | undefined, body: object) =>
    send('post', `/tickets/${ticketId}/comments`, token, body);
  const listComments = (ticketId: string, token: string | undefined) =>
    send('get', `/tickets/${ticketId}/comments`, token);

  const seedTicket = (options: { status?: TicketStatus; customerId?: string } = {}) =>
    prisma.ticket.create({
      data: {
        subject: 'Payment issue',
        body: 'Something went wrong with my payment.',
        customerId: customer.id,
        ...options,
      },
    });
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0));
  const seedComment = (
    ticketId: string,
    authorId: string,
    body: string,
    minute: number,
    isInternal = false,
  ) =>
    prisma.ticketComment.create({
      data: { ticketId, authorId, body, isInternal, createdAt: at(minute) },
    });
  const commentCount = () => prisma.ticketComment.count();
  const statusOf = async (id: string) =>
    (await prisma.ticket.findUniqueOrThrow({ where: { id } })).status;
  const auditFor = (id: string) =>
    prisma.auditLog.findMany({ where: { entity: 'ticket', entityId: id } });

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

  describe('POST /tickets/:id/comments', () => {
    it('rejects a request without a token (401)', async () => {
      const ticket = await seedTicket();
      await postComment(ticket.id, undefined, { body: 'Hello' }).expect(401);
    });

    it('lets a customer comment on their own ticket', async () => {
      const ticket = await seedTicket();

      const res = await postComment(ticket.id, customer.token, { body: 'Any update?' }).expect(201);

      expect(res.body).toMatchObject({
        ticketId: ticket.id,
        body: 'Any update?',
        isInternal: false,
        author: { id: customer.id, role: 'CUSTOMER' },
      });
    });

    it("hides another customer's ticket behind a 404 and stores nothing", async () => {
      const ticket = await seedTicket();

      await postComment(ticket.id, otherCustomer.token, { body: 'I am a stranger' }).expect(404);

      expect(await commentCount()).toBe(0);
    });

    it('lets an agent reply on any ticket', async () => {
      const ticket = await seedTicket();

      const res = await postComment(ticket.id, agent.token, { body: 'We are on it.' }).expect(201);

      expect(res.body.author).toMatchObject({ id: agent.id, role: 'AGENT' });
    });

    it('lets an agent post an internal note', async () => {
      const ticket = await seedTicket();

      const res = await postComment(ticket.id, agent.token, {
        body: 'Customer looks like a repeat case',
        isInternal: true,
      }).expect(201);

      expect(res.body.isInternal).toBe(true);
    });

    it('forbids a customer from posting an internal note (403) and stores nothing', async () => {
      const ticket = await seedTicket();

      await postComment(ticket.id, customer.token, { body: 'Secret', isInternal: true }).expect(403);

      expect(await commentCount()).toBe(0);
    });

    it('trims whitespace around the body', async () => {
      const ticket = await seedTicket();

      const res = await postComment(ticket.id, customer.token, { body: '   Thanks!   ' }).expect(
        201,
      );

      expect(res.body.body).toBe('Thanks!');
    });

    it('rejects an empty or whitespace-only body (400)', async () => {
      const ticket = await seedTicket();
      await postComment(ticket.id, customer.token, { body: '    ' }).expect(400);
    });

    it('rejects a body longer than 5000 characters (400)', async () => {
      const ticket = await seedTicket();
      await postComment(ticket.id, customer.token, { body: 'a'.repeat(5001) }).expect(400);
    });

    it('rejects an isInternal value that is not a boolean (400)', async () => {
      const ticket = await seedTicket();
      await postComment(ticket.id, agent.token, { body: 'Note', isInternal: 'yes' }).expect(400);
    });

    it('refuses to let a client choose the author (400) and stores nothing', async () => {
      const ticket = await seedTicket();

      await postComment(ticket.id, customer.token, { body: 'Hi there', authorId: agent.id }).expect(
        400,
      );

      expect(await commentCount()).toBe(0);
    });

    it('refuses comments on a CLOSED ticket (409) and stores nothing', async () => {
      const ticket = await seedTicket({ status: 'CLOSED' });

      await postComment(ticket.id, agent.token, { body: 'Too late' }).expect(409);

      expect(await commentCount()).toBe(0);
    });

    it('returns 404 for a ticket that does not exist', async () => {
      await postComment(NO_SUCH_ID, agent.token, { body: 'Hello' }).expect(404);
    });

    it('rejects an id that is not a UUID (400)', async () => {
      await postComment('abc', agent.token, { body: 'Hello' }).expect(400);
    });
  });

  describe('GET /tickets/:id/comments', () => {
    it('rejects a request without a token (401)', async () => {
      const ticket = await seedTicket();
      await listComments(ticket.id, undefined).expect(401);
    });

    it('shows a customer the public comments only, oldest first', async () => {
      const ticket = await seedTicket();
      await seedComment(ticket.id, customer.id, 'first', 1);
      await seedComment(ticket.id, agent.id, 'internal note', 2, true);
      await seedComment(ticket.id, agent.id, 'second', 3);

      const res = await listComments(ticket.id, customer.token).expect(200);

      expect(res.body.map((c: { body: string }) => c.body)).toEqual(['first', 'second']);
    });

    it('shows an agent every comment including internal notes, oldest first', async () => {
      const ticket = await seedTicket();
      await seedComment(ticket.id, customer.id, 'first', 1);
      await seedComment(ticket.id, agent.id, 'internal note', 2, true);
      await seedComment(ticket.id, agent.id, 'second', 3);

      const res = await listComments(ticket.id, agent.token).expect(200);

      expect(res.body.map((c: { body: string }) => c.body)).toEqual([
        'first',
        'internal note',
        'second',
      ]);
    });

    it("hides another customer's thread behind a 404", async () => {
      const ticket = await seedTicket();
      await seedComment(ticket.id, customer.id, 'private conversation', 1);

      await listComments(ticket.id, otherCustomer.token).expect(404);
    });

    it('returns 404 for a ticket that does not exist', async () => {
      await listComments(NO_SUCH_ID, agent.token).expect(404);
    });

    it('exposes only id, name and role of the author', async () => {
      const ticket = await seedTicket();
      await seedComment(ticket.id, agent.id, 'hello', 1);

      const res = await listComments(ticket.id, customer.token).expect(200);

      expect(Object.keys(res.body[0].author).sort()).toEqual(['id', 'name', 'role']);
    });
  });

  describe('automatic status changes', () => {
    it('moves WAITING_CUSTOMER to IN_PROGRESS when the customer replies, and logs why', async () => {
      const ticket = await seedTicket({ status: 'WAITING_CUSTOMER' });

      await postComment(ticket.id, customer.token, { body: 'Here is the info you asked for' }).expect(
        201,
      );

      expect(await statusOf(ticket.id)).toBe('IN_PROGRESS');
      const entries = await auditFor(ticket.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        action: 'ticket.status_changed',
        actorId: customer.id,
        diff: {
          status: { from: 'WAITING_CUSTOMER', to: 'IN_PROGRESS' },
          reason: 'customer_reply',
        },
      });
    });

    it('reopens a RESOLVED ticket when the customer replies', async () => {
      const ticket = await seedTicket({ status: 'RESOLVED' });

      await postComment(ticket.id, customer.token, { body: 'It is still broken' }).expect(201);

      expect(await statusOf(ticket.id)).toBe('IN_PROGRESS');
    });

    it('leaves an OPEN ticket as it is when the customer comments', async () => {
      const ticket = await seedTicket({ status: 'OPEN' });

      await postComment(ticket.id, customer.token, { body: 'Please hurry' }).expect(201);

      expect(await statusOf(ticket.id)).toBe('OPEN');
      expect(await auditFor(ticket.id)).toHaveLength(0);
    });

    it('leaves an IN_PROGRESS ticket as it is when the customer comments', async () => {
      const ticket = await seedTicket({ status: 'IN_PROGRESS' });

      await postComment(ticket.id, customer.token, { body: 'Any news?' }).expect(201);

      expect(await statusOf(ticket.id)).toBe('IN_PROGRESS');
    });

    it('does not change the status when an agent replies', async () => {
      const ticket = await seedTicket({ status: 'WAITING_CUSTOMER' });

      await postComment(ticket.id, agent.token, { body: 'Still waiting for your reply' }).expect(
        201,
      );

      expect(await statusOf(ticket.id)).toBe('WAITING_CUSTOMER');
    });

    it('never changes the status for an internal note', async () => {
      const ticket = await seedTicket({ status: 'RESOLVED' });

      await postComment(ticket.id, agent.token, { body: 'Checking logs', isInternal: true }).expect(
        201,
      );

      expect(await statusOf(ticket.id)).toBe('RESOLVED');
    });
  });
});