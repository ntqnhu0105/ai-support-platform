import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

// Load the test database URL, overriding anything already set in this terminal.
config({ path: '.env.test', override: true, quiet: true });

const url = process.env.DATABASE_URL;
if (!url || !/test/i.test(new URL(url).pathname)) {
  console.error(
    'Refusing to migrate: DATABASE_URL in .env.test must point to a database whose name contains "test".',
  );
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
process.exit(result.status ?? 1);