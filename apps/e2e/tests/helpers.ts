import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_URL = 'http://localhost:4100';
export const DEMO_PASSWORD = 'Demo12345!';

export const users = {
  admin: 'demo.admin@example.com',
  agent1: 'demo.agent1@example.com',
  agent2: 'demo.agent2@example.com',
  customer1: 'demo.customer1@example.com',
  customer2: 'demo.customer2@example.com',
  customer3: 'demo.customer3@example.com',
} as const;

/** Fills the login form that is already on screen. No page load, so nothing in memory is reset. */
export async function fillLogin(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await fillLogin(page, email);
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function apiLogin(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(res.ok(), `API login for ${email}`).toBeTruthy();
  return ((await res.json()) as { accessToken: string }).accessToken;
}

export async function apiCreateTicket(
  request: APIRequestContext,
  token: string,
  subject: string,
): Promise<string> {
  const res = await request.post(`${API_URL}/tickets`, {
    headers: bearer(token),
    data: { subject, body: 'Created by an automated end-to-end test.' },
  });
  expect(res.status(), 'API create ticket').toBe(201);
  return ((await res.json()) as { id: string }).id;
}

export async function apiTicketIds(request: APIRequestContext, token: string): Promise<string[]> {
  const res = await request.get(`${API_URL}/tickets?pageSize=50`, { headers: bearer(token) });
  expect(res.ok(), 'API list tickets').toBeTruthy();
  const page = (await res.json()) as { items: { id: string }[] };
  return page.items.map((ticket) => ticket.id);
}

export const uniqueSubject = (label: string) => `${label} ${Date.now()}`;