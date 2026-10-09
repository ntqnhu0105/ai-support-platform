import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { TEST_PASSWORD, createTestApp, resetDatabase } from './helpers/test-app.js';

const COOKIE_NAME = 'refresh_token';

describe('Refresh tokens (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = 'an@example.com';

  const setCookies = (res: request.Response): string[] =>
    (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

  /** Returns "refresh_token=<value>" as the browser would send it back. */
  const cookieFrom = (res: request.Response): string | undefined =>
    setCookies(res)
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split(';')[0];

  const refresh = (cookie?: string) => {
    const req = request(app.getHttpServer()).post('/auth/refresh');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  const logout = (cookie: string) =>
    request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie);

  const registerAndLogin = async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email, password: TEST_PASSWORD })
      .expect(201);
    const res = await request(server)
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return { res, cookie: cookieFrom(res)!, accessToken: res.body.accessToken as string };
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

  it('login sets an httpOnly cookie scoped to /auth and keeps the token out of the body', async () => {
    const { res } = await registerAndLogin();

    const raw = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME}=`));
    expect(raw).toBeDefined();
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('Path=/auth');
    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const { cookie } = await registerAndLogin();
    const tokenValue = cookie.split('=')[1];

    const row = await prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(tokenValue);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('issues a working access token and a new refresh token on refresh', async () => {
    const { cookie } = await registerAndLogin();

    const res = await refresh(cookie).expect(200);
    expect(res.body).not.toHaveProperty('refreshToken');

    const nextCookie = cookieFrom(res);
    expect(nextCookie).toBeDefined();
    expect(nextCookie).not.toBe(cookie);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('revokes the whole token family when an old token is replayed', async () => {
    const { cookie: first } = await registerAndLogin();

    const second = cookieFrom(await refresh(first).expect(200))!;

    await refresh(first).expect(401); // replay of an already used token
    await refresh(second).expect(401); // the family was revoked, even the newest token
  });

  it('rejects a request without a cookie', async () => {
    await refresh().expect(401);
  });

  it('rejects a made-up token', async () => {
    await refresh(`${COOKIE_NAME}=not-a-real-token`).expect(401);
  });

  it('rejects an expired token', async () => {
    const { cookie } = await registerAndLogin();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    await refresh(cookie).expect(401);
  });

  it('logout revokes the token and clears the cookie', async () => {
    const { cookie } = await registerAndLogin();

    const res = await logout(cookie).expect(204);
    expect(setCookies(res).some((c) => c.startsWith(`${COOKIE_NAME}=;`))).toBe(true);

    await refresh(cookie).expect(401);
  });

  it('logout without a cookie still succeeds', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(204);
  });

  it('applies a role change at the next refresh', async () => {
    const { cookie, accessToken: oldToken } = await registerAndLogin();
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });

    // The old access token still says CUSTOMER.
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(403);

    const res = await refresh(cookie).expect(200);

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('refuses to refresh for a deactivated account', async () => {
    const { cookie } = await registerAndLogin();
    await prisma.user.update({ where: { email }, data: { isActive: false } });

    await refresh(cookie).expect(401);
  });
});