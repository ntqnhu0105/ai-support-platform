import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let otherCustomer: TestUser;
  let agent: TestUser;
  let admin: TestUser;

  const validTicket = {
    subject: 'Cannot withdraw money',
    body: 'My withdrawal has been pending for three days.',
  };
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createTicket = (token: string | undefined, body: object) => {
    const req = request(app.getHttpServer()).post('/tickets');
    return token ? req.set(bearer(token)).send(body) : req.send(body);
  };
  const getTicket = (id: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/tickets/${id}`);
    return token ? req.set(bearer(token)) : req;
  };
  const makeTicket = async (user: TestUser) =>
    (await createTicket(user.token, validTicket).expect(201)).body.id as string;

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
    admin = await createUser(app, prisma, { email: 'admin@example.com', role: 'ADMIN' });
  });

  describe('POST /tickets', () => {
    it('rejects creation without a token (401)', async () => {
      await createTicket(undefined, validTicket).expect(401);
    });

    it('creates an OPEN ticket owned by the caller', async () => {
      const res = await createTicket(customer.token, validTicket).expect(201);

      expect(res.body).toMatchObject({
        subject: validTicket.subject,
        body: validTicket.body,
        status: 'OPEN',
        priority: 'MEDIUM',
        customerId: customer.id,
        assigneeId: null,
      });
      expect(res.body.code).toMatch(/^TCK-\d{4,}$/);
    });

    it('trims whitespace around subject and body', async () => {
      const res = await createTicket(customer.token, {
        subject: '   Card declined   ',
        body: '   Payment fails at checkout every time.   ',
      }).expect(201);

      expect(res.body.subject).toBe('Card declined');
      expect(res.body.body).toBe('Payment fails at checkout every time.');
    });

    it('rejects a subject that is too short', async () => {
      await createTicket(customer.token, { ...validTicket, subject: 'Hi' }).expect(400);
    });

    it('rejects a missing body', async () => {
      await createTicket(customer.token, { subject: validTicket.subject }).expect(400);
    });

    it.each([
      ['status', 'CLOSED'],
      ['priority', 'URGENT'],
      ['customerId', '00000000-0000-4000-8000-000000000000'],
      ['assigneeId', '00000000-0000-4000-8000-000000000000'],
    ])('refuses a client that sets %s itself', async (field, value) => {
      await createTicket(customer.token, { ...validTicket, [field]: value }).expect(400);

      expect(await prisma.ticket.count()).toBe(0);
    });
  });

  describe('GET /tickets/:id', () => {
    it('rejects reading without a token (401)', async () => {
      const id = await makeTicket(customer);
      await getTicket(id).expect(401);
    });

    it('lets a customer read their own ticket', async () => {
      const id = await makeTicket(customer);

      const res = await getTicket(id, customer.token).expect(200);
      expect(res.body.id).toBe(id);
    });

    it("hides another customer's ticket behind a 404, not a 403", async () => {
      const id = await makeTicket(customer);

      await getTicket(id, otherCustomer.token).expect(404);
    });

    it('lets an agent read any ticket', async () => {
      const id = await makeTicket(customer);
      await getTicket(id, agent.token).expect(200);
    });

    it('lets an admin read any ticket', async () => {
      const id = await makeTicket(customer);
      await getTicket(id, admin.token).expect(200);
    });

    it('rejects an id that is not a UUID (400)', async () => {
      await getTicket('abc', customer.token).expect(400);
    });

    it('returns 404 for a ticket that does not exist', async () => {
      await getTicket('00000000-0000-4000-8000-000000000000', customer.token).expect(404);
    });
  });
});