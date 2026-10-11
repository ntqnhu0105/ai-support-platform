import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';

const WEB_ORIGIN = 'http://localhost:3000';
const FOREIGN_ORIGIN = 'https://evil.example';

describe('CORS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the preflight of the web app and allows credentials and the Authorization header', async () => {
    const res = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers']?.toLowerCase()).toContain('authorization');
  });

  it('does not grant access to any other origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', FOREIGN_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('adds the CORS headers to a normal response for the web app', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});