import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import {
  TEST_PASSWORD,
  createTestApp,
  createUser,
  resetDatabase,
  type TestUser,
} from './helpers/test-app.js';

describe('Users admin API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: TestUser;
  let agent: TestUser;
  let customer: TestUser;

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const listUsers = (token?: string) => {
    const req = request(app.getHttpServer()).get('/users');
    return token ? req.set(bearer(token)) : req;
  };
  const changeRole = (id: string, token: string, body: object) =>
    request(app.getHttpServer()).patch(`/users/${id}/role`).set(bearer(token)).send(body);
  const roleInDb = async (id: string) =>
    (await prisma.user.findUniqueOrThrow({ where: { id } })).role;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    admin = await createUser(app, prisma, { email: 'admin@example.com', role: 'ADMIN' });
    agent = await createUser(app, prisma, { email: 'agent@example.com', role: 'AGENT' });
    customer = await createUser(app, prisma, { email: 'customer@example.com' });
  });

  describe('GET /users', () => {
    it('rejects a request without a token (401)', async () => {
      await listUsers().expect(401);
    });

    it('rejects a customer (403)', async () => {
      await listUsers(customer.token).expect(403);
    });

    it('rejects an agent (403)', async () => {
      await listUsers(agent.token).expect(403);
    });

    it('lets an admin list users without exposing password hashes', async () => {
      const res = await listUsers(admin.token).expect(200);

      expect(res.body).toHaveLength(3);
      for (const user of res.body) {
        expect(user).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('lets an admin promote a customer to agent', async () => {
      const res = await changeRole(customer.id, admin.token, { role: 'AGENT' }).expect(200);

      expect(res.body.role).toBe('AGENT');
      expect(await roleInDb(customer.id)).toBe('AGENT');
    });

    it('stops a customer from promoting themselves and leaves the database unchanged', async () => {
      await changeRole(customer.id, customer.token, { role: 'ADMIN' }).expect(403);

      expect(await roleInDb(customer.id)).toBe('CUSTOMER');
    });

    it('stops an agent from promoting a customer', async () => {
      await changeRole(customer.id, agent.token, { role: 'AGENT' }).expect(403);

      expect(await roleInDb(customer.id)).toBe('CUSTOMER');
    });

    it('rejects a role that does not exist (400)', async () => {
      await changeRole(customer.id, admin.token, { role: 'SUPERUSER' }).expect(400);
    });

    it('rejects an id that is not a UUID (400)', async () => {
      await changeRole('abc', admin.token, { role: 'AGENT' }).expect(400);
    });

    it('forbids an admin from changing their own role (400)', async () => {
      await changeRole(admin.id, admin.token, { role: 'CUSTOMER' }).expect(400);

      expect(await roleInDb(admin.id)).toBe('ADMIN');
    });

    it('returns 404 for a user that does not exist', async () => {
      await changeRole('00000000-0000-4000-8000-000000000000', admin.token, {
        role: 'AGENT',
      }).expect(404);
    });

    it('keeps the old role inside an old token until the user logs in again', async () => {
      await prisma.user.update({ where: { id: customer.id }, data: { role: 'ADMIN' } });

      // The token was issued while the user was a CUSTOMER, so it is still refused.
      await listUsers(customer.token).expect(403);

      const fresh = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: customer.email, password: TEST_PASSWORD })
        .expect(200);

      await listUsers(fresh.body.accessToken).expect(200);
    });
  });
});