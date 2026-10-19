import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

const repoRoot = path.resolve(__dirname, '../..');
config({ path: path.resolve(__dirname, '.env.e2e'), quiet: true });

const API_PORT = 4100;
const WEB_PORT = 3100;

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl || !/e2e/i.test(new URL(databaseUrl).pathname)) {
  throw new Error('E2E_DATABASE_URL must point to a database whose name contains "e2e".');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1, // every test shares one database
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter api start',
      cwd: repoRoot,
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: 'e2e-secret-not-for-production',
        JWT_ACCESS_TTL_SECONDS: '900',
        WEB_URL: `http://localhost:${WEB_PORT}`,
        PORT: String(API_PORT),
      },
    },
    {
      command: `pnpm --filter web build && pnpm --filter web exec next start -p ${WEB_PORT}`,
      cwd: repoRoot,
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});