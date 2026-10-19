import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
config({ path: path.resolve(here, '../.env.e2e'), quiet: true });

const url = process.env.E2E_DATABASE_URL;
if (!url || !/e2e/i.test(new URL(url).pathname)) {
  console.error(
    'Refusing to continue: E2E_DATABASE_URL must point to a database whose name contains "e2e".',
  );
  process.exit(1);
}

// Everything below runs against the e2e database only, whatever apps/api/.env says.
const env = { ...process.env, DATABASE_URL: url };
const run = (command) => execSync(command, { cwd: repoRoot, env, stdio: 'inherit' });

run('pnpm --filter api exec prisma migrate deploy');
