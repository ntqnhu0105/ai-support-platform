import type { CookieOptions } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

export function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth',
    maxAge: maxAgeMs,
  };
}