import * as argon2 from 'argon2';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from './password.js';

const memoryOf = (hash: string): number => Number(/\$m=(\d+),/.exec(hash)?.[1]);

describe('hashPassword', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses strong argon2 parameters by default', async () => {
    vi.stubEnv('ARGON2_FAST', '');

    const hash = await hashPassword('Password123!');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(memoryOf(hash)).toBeGreaterThanOrEqual(19456); // OWASP minimum memory
  });

  it('hashes cheaply when ARGON2_FAST=1 and the hash still verifies', async () => {
    vi.stubEnv('ARGON2_FAST', '1');

    const hash = await hashPassword('Password123!');

    expect(hash).toContain('m=1024,p=1,t=1');
    expect(await argon2.verify(hash, 'Password123!')).toBe(true);
  });

  it('refuses cheap hashing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ARGON2_FAST', '1');

    await expect(hashPassword('Password123!')).rejects.toThrow('must never be enabled in production');
  });
});