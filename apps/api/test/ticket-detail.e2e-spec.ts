import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

describe('Ticket detail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let agent: TestUser;

  const getTicket = (id: string, token: string) =>
    request(app.getHttpServer()).get(`/tickets/${id}`).set('Authorization', `Bearer ${token}`);
  const seedTicket = (assigneeId?: string) =>
    prisma.ticket.create({
      data: {
        subject: 'Payment issue',
        body: 'Something went wrong with my payment.',
        customerId: customer.id,
        assigneeId,
      },
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
    await prisma.user.update({ where: { id: customer.id }, data: { name: 'Linh Tran' } });
    await prisma.user.update({ where: { id: agent.id }, data: { name: 'Sam Support' } });
  });

  it('includes the names of the customer and of the assignee', async () => {
    const ticket = await seedTicket(agent.id);

    const res = await getTicket(ticket.id, customer.token).expect(200);

    expect(res.body.customer).toEqual({ id: customer.id, name: 'Linh Tran' });
    expect(res.body.assignee).toEqual({ id: agent.id, name: 'Sam Support' });
  });

  it('reports no assignee for a ticket nobody has taken yet', async () => {
    const ticket = await seedTicket();

    const res = await getTicket(ticket.id, agent.token).expect(200);

    expect(res.body.assignee).toBeNull();
  });

  it('exposes only the id and name of the people involved, never an email', async () => {
    const ticket = await seedTicket(agent.id);

    const res = await getTicket(ticket.id, agent.token).expect(200);

    expect(Object.keys(res.body.customer).sort()).toEqual(['id', 'name']);
    expect(Object.keys(res.body.assignee).sort()).toEqual(['id', 'name']);
    expect(JSON.stringify(res.body)).not.toContain('example.com');
  });
});