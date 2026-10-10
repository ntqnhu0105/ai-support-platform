import type { INestApplication } from '@nestjs/common';
import { createOpenApiDocument } from '../src/swagger.js';
import { createTestApp } from './helpers/test-app.js';

type Operation = { security?: unknown[]; tags?: string[] };
type Doc = { paths: Record<string, Record<string, Operation>> };

const PUBLIC_ROUTES = new Set([
  'GET /',
  'GET /health',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
]);

describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;
  let operations: Map<string, Operation>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    const doc = createOpenApiDocument(app) as unknown as Doc;

    operations = new Map();
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        operations.set(`${method.toUpperCase()} ${path}`, operation);
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents the routes of the API', () => {
    expect([...operations.keys()]).toEqual(
      expect.arrayContaining([
        'GET /health',
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/refresh',
        'POST /auth/logout',
        'GET /auth/me',
        'GET /users',
        'PATCH /users/{id}/role',
        'POST /tickets',
        'GET /tickets',
        'GET /tickets/{id}',
        'PATCH /tickets/{id}/status',
        'POST /tickets/{id}/assign',
        'POST /tickets/{id}/unassign',
        'GET /tickets/{id}/history',
        'POST /tickets/{ticketId}/comments',
        'GET /tickets/{ticketId}/comments',
      ]),
    );
  });

  it('declares a bearer token on every protected route', () => {
    for (const [route, operation] of operations) {
      if (PUBLIC_ROUTES.has(route)) continue;
      expect(operation.security?.length ?? 0, `${route} must require a bearer token`).toBeGreaterThan(0);
    }
  });

  it('does not ask for a bearer token on public routes', () => {
    for (const route of PUBLIC_ROUTES) {
      const operation = operations.get(route);
      if (!operation) continue;
      expect(operation.security ?? [], `${route} must stay public`).toHaveLength(0);
    }
  });
});