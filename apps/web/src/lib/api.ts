const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type Role = 'CUSTOMER' | 'AGENT' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Kept in memory only. Never put it in localStorage.
let accessToken: string | null = null;
let refreshPromise: Promise<AuthResult | null> | null = null;

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(', ');
    else if (body.message) message = body.message;
  } catch {
    // The body was not JSON: keep the generic message.
  }
  return new ApiError(res.status, message);
}

function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  // credentials: 'include' lets the browser send and store the refresh cookie.
  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
}

async function doRefresh(): Promise<AuthResult | null> {
  try {
    const res = await send('/auth/refresh', { method: 'POST' });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = (await res.json()) as AuthResult;
    accessToken = data.accessToken;
    return data;
  } catch {
    // The API is unreachable: treat it as "not signed in" rather than crashing.
    accessToken = null;
    return null;
  }
}

/** Every caller that asks while a refresh is running shares that one request. */
export function refreshSession(): Promise<AuthResult | null> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit, retryOnUnauthorized: boolean): Promise<T> {
  const tokenUsed = accessToken;
  let res = await send(path, init);

  if (res.status === 401 && retryOnUnauthorized) {
    // If another request already renewed the token, just retry; otherwise renew it ourselves.
    const sessionValid = accessToken !== tokenUsed || (await refreshSession()) !== null;
    if (sessionValid) res = await send(path, init);
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  // A 401 here means "wrong password": renewing the session would make no sense.
  const data = await request<AuthResult>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  accessToken = data.accessToken;
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' }, false);
  } finally {
    accessToken = null;
  }
}