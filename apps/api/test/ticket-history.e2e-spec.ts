import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, createUser, resetDatabase, type TestUser } from './helpers/test-app.js';

describe('Ticket history details (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let customer: TestUser;
  let agent: TestUser;
  let admin: TestUser;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const seedTicket = () =>
    prisma.ticket.create({
      data: {
        subject: 'Payment issue',
        body: 'Something went wrong with my payment.',
        customerId: customer.id,
      },
    });
  const history = (id: string, token: string) =>
    request(app.getHttpServer()).get(`/tickets/${id}/history`).set(bearer(token));

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
    admin = await createUser(app, prisma, { email: 'admin@example.com', role: 'ADMIN' });
    await prisma.user.update({ where: { id: agent.id }, data: { name: 'Sam Support' } });
    await prisma.user.update({ where: { id: admin.id }, data: { name: 'Alex Admin' } });
  });

  it('includes the name and role of whoever made each change', async () => {
    const ticket = await seedTicket();
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/assign`)
      .set(bearer(agent.token))
      .send({})
      .expect(200);

    const res = await history(ticket.id, agent.token).expect(200);

    expect(res.body[0].actor).toEqual({ id: agent.id, name: 'Sam Support', role: 'AGENT' });
  });

  it('names the person an admin assigned the ticket to', async () => {
    const ticket = await seedTicket();
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/assign`)
      .set(bearer(admin.token))
      .send({ assigneeId: agent.id })
      .expect(200);

    const res = await history(ticket.id, admin.token).expect(200);

    expect(res.body[0].actor.name).toBe('Alex Admin');
    expect(res.body[0].people).toEqual({ [agent.id]: 'Sam Support' });
  });

  it('never exposes an email address', async () => {
    const ticket = await seedTicket();
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/assign`)
      .set(bearer(admin.token))
      .send({ assigneeId: agent.id })
      .expect(200);

    const res = await history(ticket.id, admin.token).expect(200);

    expect(JSON.stringify(res.body)).not.toContain('example.com');
  });
});