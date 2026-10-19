import { expect, test } from './fixtures';
import { fillLogin, signIn, signOut, users } from './helpers';

test.describe('authentication', () => {
  test('shows an error for a wrong password and stays on the login page', async ({ page }) => {
    await page.goto('/login');
    await fillLogin(page, users.agent1, 'WrongPassword1!');

    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('signs an agent in and lists every ticket', async ({ page }) => {
    await signIn(page, users.agent1);

    await expect(page.getByText(/^16 tickets/)).toBeVisible();
  });

  test('keeps the session after a reload', async ({ page }) => {
    await signIn(page, users.agent1);

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page).toHaveURL(/\/tickets$/);
  });

  test('shows each user their own tickets when accounts are switched without a reload', async ({
    page,
  }) => {
    await signIn(page, users.customer1);
    await expect(page.getByText(/^6 tickets/)).toBeVisible();

    await signOut(page);
    await fillLogin(page, users.customer2); // same page: nothing is reloaded in between

    await expect(page.getByText(/^5 tickets/)).toBeVisible();
    await expect(page.getByText(/^6 tickets/)).toHaveCount(0);
  });

  test('sends visitors without a session to the login page', async ({ page }) => {
    await page.goto('/tickets');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('closes the tickets page again once the user has signed out', async ({ page }) => {
    await signIn(page, users.agent1);
    await signOut(page);

    await page.goto('/tickets');

    await expect(page).toHaveURL(/\/login$/);
  });
});