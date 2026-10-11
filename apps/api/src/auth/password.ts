import * as argon2 from 'argon2';

const FAST_OPTIONS = { memoryCost: 1024, timeCost: 1, parallelism: 1 };

/**
 * Production always uses argon2's strong defaults.
 * ARGON2_FAST=1 (set only by the test setup) makes hashing cheap so the test suite stays fast.
 */
  export async function hashPassword(password: string): Promise<string> {
    if (process.env.ARGON2_FAST === '1') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ARGON2_FAST must never be enabled in production');
  }

  return argon2.hash(password, FAST_OPTIONS);
  }

  return argon2.hash(password);
}