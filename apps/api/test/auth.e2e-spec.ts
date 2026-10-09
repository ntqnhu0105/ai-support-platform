import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from './helpers/test-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const credentials = { email: 'an@example.com', password: 'Password123!' };

  const register = (body: object) =>
    request(app.getHttpServer()).post('/auth/register').send(body);
  const login = (body: object) => request(app.getHttpServer()).post('/auth/login').send(body);
  const me = (token?: string) => {
    const req = request(app.getHttpServer()).get('/auth/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  describe('POST /auth/register', () => {
    it('creates a customer, normalizes the email and never returns the hash', async () => {
      const res = await register({ ...credentials, email: 'An@Example.com', name: 'An' }).expect(201);

      expect(res.body.email).toBe('an@example.com');
      expect(res.body.role).toBe('CUSTOMER');
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('stores the password hashed with argon2, not in plain text', async () => {
      await register(credentials).expect(201);

      const user = await prisma.user.findUnique({ where: { email: credentials.email } });
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user?.passwordHash).not.toContain(credentials.password);
    });

    it('rejects a duplicate email regardless of letter case', async () => {
      await register(credentials).expect(201);
      await register({ ...credentials, email: 'AN@example.com' }).expect(409);
    });

    it('rejects an invalid email', async () => {
      await register({ ...credentials, email: 'not-an-email' }).expect(400);
    });

    it('rejects a password shorter than 8 characters', async () => {
      await register({ ...credentials, password: '123' }).expect(400);
    });

    it('refuses a client that tries to choose its own role', async () => {
      const res = await register({ ...credentials, role: 'ADMIN' }).expect(400);

      expect(res.body.message).toContain('property role should not exist');
      expect(await prisma.user.count()).toBe(0);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register(credentials).expect(201);
    });

    it('returns an access token for valid credentials', async () => {
      const res = await login(credentials).expect(200);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user.email).toBe(credentials.email);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('rejects a wrong password and an unknown email with the same message', async () => {
      const wrongPassword = await login({ ...credentials, password: 'WrongPass123!' }).expect(401);
      const unknownEmail = await login({ ...credentials, email: 'nobody@example.com' }).expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('rejects a deactivated account', async () => {
      await prisma.user.update({ where: { email: credentials.email }, data: { isActive: false } });
      await login(credentials).expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let token: string;

    beforeEach(async () => {
      await register(credentials).expect(201);
      token = (await login(credentials).expect(200)).body.accessToken;
    });

    it('rejects a request without a token', async () => {
      await me().expect(401);
    });

    it('returns the current user for a valid token', async () => {
      const res = await me(token).expect(200);
      expect(res.body.email).toBe(credentials.email);
    });

    it('rejects a tampered token', async () => {
      await me(token.slice(0, -2) + 'xx').expect(401);
    });

    it('rejects a valid token once the account is deactivated', async () => {
      await prisma.user.update({ where: { email: credentials.email }, data: { isActive: false } });
      await me(token).expect(401);
    });
  });
});