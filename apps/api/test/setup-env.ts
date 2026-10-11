import { config } from 'dotenv';

// Load local test settings. dotenv never overrides variables that already exist,
// so in CI the values set by the workflow win.
config({ path: '.env.test' });

process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-not-for-production';
process.env.JWT_ACCESS_TTL_SECONDS ??= '900';
process.env.WEB_URL = 'http://localhost:3000'; // fixed, so the CORS tests never depend on the developer's shell
process.env.ARGON2_FAST = '1';

// Safety net: refuse to run against anything that is not a test database.
const url = process.env.DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must point to a database whose name contains "test".',
  );
}