import { expect, test } from './fixtures';
import { apiLogin, apiTicketIds, signIn, users } from './helpers';

test.describe('tickets', () => {
  test("a customer cannot open another customer's ticket", async ({ page, request }) => {
    const ownerToken = await apiLogin(request, users.customer1);
    const [ticketId] = await apiTicketIds(request, ownerToken);
    expect(ticketId, 'customer1 should own at least one ticket').toBeDefined();

    await signIn(page, users.customer2);
    await page.goto(`/tickets/${ticketId}`);

    await expect(page.getByText('Ticket not found.')).toBeVisible();
  });

  test('a closed ticket offers no reply box', async ({ page }) => {
    await signIn(page, users.customer1);

    await page.getByRole('link', { name: 'How do I close my account?' }).click();

    await expect(
      page.getByText('This ticket is closed, so it no longer accepts replies.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reply' })).toHaveCount(0);
  });

  test('refuses an empty new ticket before anything is sent', async ({ page }) => {
    let ticketPosts = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === '/tickets') ticketPosts++;
    });

    await signIn(page, users.customer1);
    await page.getByRole('link', { name: 'New ticket' }).click();
    await page.getByRole('button', { name: 'Submit ticket' }).click();

    await expect(page.getByText('Subject must be at least 5 characters')).toBeVisible();
    await expect(page.getByText('Description must be at least 10 characters')).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/new$/);
    expect(ticketPosts).toBe(0);
  });
});