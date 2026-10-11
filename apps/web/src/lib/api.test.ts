import { beforeEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('./api');

interface FakeServer {
  validToken: string;
  loginAllowed: boolean;
  refreshAllowed: boolean;
  calls: { method: string; path: string; auth: string | null }[];
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const user = {
  id: 'u1',
  email: 'a@example.com',
  name: 'A',
  role: 'AGENT',
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** A tiny stand-in for the real API: token-1 is issued at login, token-2 at refresh. */
function installFakeServer(): FakeServer {
  const server: FakeServer = {
    validToken: 'token-1',
    loginAllowed: true,
    refreshAllowed: true,
    calls: [],
  };

  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    const auth = new Headers(init.headers).get('Authorization');
    server.calls.push({ method, path, auth });

    // Let concurrent callers genuinely overlap, like real network requests do.
    await Promise.resolve();

    if (path === '/auth/login') {
      return server.loginAllowed
        ? json(200, { accessToken: 'token-1', user })
        : json(401, { message: 'Invalid email or password' });
    }
    if (path === '/auth/refresh') {
      return server.refreshAllowed
        ? json(200, { accessToken: 'token-2', user })
        : json(401, { message: 'Invalid refresh token' });
    }
    if (path === '/auth/logout') {
      return new Response(null, { status: 204 });
    }
    if (path === '/tickets') {
      return auth === `Bearer ${server.validToken}`
        ? json(200, { items: [] })
        : json(401, { message: 'Invalid or expired token' });
    }
    if (path === '/invalid') {
      return json(400, { message: ['email must be an email', 'password is too short'] });
    }
    return json(404, { message: 'Not found' });
  });

  return server;
}

const refreshCalls = (server: FakeServer) =>
  server.calls.filter((call) => call.path === '/auth/refresh');

describe('API client', () => {
  let api: Api;
  let server: FakeServer;

  beforeEach(async () => {
    vi.resetModules(); // the client keeps the token in module state, so start each test clean
    server = installFakeServer();
    api = await import('./api');
  });

  it('shares one refresh request between callers that ask at the same time', async () => {
    const [first, second] = await Promise.all([api.refreshSession(), api.refreshSession()]);

    expect(first?.accessToken).toBe('token-2');
    expect(second).toBe(first);
    expect(refreshCalls(server)).toHaveLength(1);
  });

  it('starts a new refresh once the previous one has finished', async () => {
    await api.refreshSession();
    await api.refreshSession();

    expect(refreshCalls(server)).toHaveLength(2);
  });

  it('sends the access token obtained at login', async () => {
    await api.login('a@example.com', 'secret');
    await api.apiFetch('/tickets');

    const ticketCall = server.calls.find((call) => call.path === '/tickets');
    expect(ticketCall?.auth).toBe('Bearer token-1');
  });

  it('renews an expired token once and retries the request', async () => {
    await api.login('a@example.com', 'secret');
    server.validToken = 'token-2'; // token-1 has just expired

    await expect(api.apiFetch('/tickets')).resolves.toEqual({ items: [] });

    expect(server.calls.map((call) => call.path)).toEqual([
      '/auth/login',
      '/tickets',
      '/auth/refresh',
      '/tickets',
    ]);
    expect(server.calls[3]?.auth).toBe('Bearer token-2');
  });

  it('sends a single refresh when several requests expire together', async () => {
    await api.login('a@example.com', 'secret');
    server.validToken = 'token-2';

    await Promise.all([api.apiFetch('/tickets'), api.apiFetch('/tickets'), api.apiFetch('/tickets')]);

    expect(refreshCalls(server)).toHaveLength(1);
  });

  it('does not try to renew the session when login itself fails', async () => {
    server.loginAllowed = false;

    await expect(api.login('a@example.com', 'wrong')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password',
    });

    expect(refreshCalls(server)).toHaveLength(0);
  });

  it('forgets the token when the session can no longer be renewed', async () => {
    await api.login('a@example.com', 'secret');
    server.refreshAllowed = false;

    await expect(api.refreshSession()).resolves.toBeNull();
    server.calls.length = 0;

    await expect(api.apiFetch('/tickets')).rejects.toMatchObject({ status: 401 });
    const ticketCall = server.calls.find((call) => call.path === '/tickets');
    expect(ticketCall?.auth).toBeNull();
  });

  it('turns validation errors into one readable message', async () => {
    await expect(api.apiFetch('/invalid')).rejects.toMatchObject({
      status: 400,
      message: 'email must be an email, password is too short',
    });
  });

  it('drops the token on logout', async () => {
    await api.login('a@example.com', 'secret');
    await api.logout();
    server.refreshAllowed = false;

    await expect(api.apiFetch('/tickets')).rejects.toMatchObject({ status: 401 });
    const ticketCall = server.calls.find((call) => call.path === '/tickets');
    expect(ticketCall?.auth).toBeNull();
  });
});