import { execSync } from 'node:child_process';
import path from 'node:path';
import { test as base } from '@playwright/test';

const repoRoot = path.resolve(__dirname, '../../..');

/** Puts the e2e database back to the demo data: tickets, comments and history made by earlier tests disappear. */
export function resetDemoData(): void {
  const url = process.env.E2E_DATABASE_URL;
  if (!url || !/e2e/i.test(new URL(url).pathname)) {
    throw new Error(
      'Refusing to reset: E2E_DATABASE_URL must point to a database whose name contains "e2e".',
    );
  }

  try {
    execSync('pnpm --filter api db:seed', {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    const detail = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`Resetting the demo data failed:\n${detail}`);
  }
}

// An "auto" fixture runs for every test without being mentioned in it, and also on every retry.
export const test = base.extend<{ freshData: void }>({
  freshData: [
    async ({}, use) => {
      resetDemoData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';