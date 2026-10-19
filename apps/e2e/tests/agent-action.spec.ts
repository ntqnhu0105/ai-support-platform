import { expect, test } from './fixtures';
import { apiCreateTicket, apiLogin, signIn, uniqueSubject, users } from './helpers';

test.describe('agent actions', () => {
  test('an agent takes a ticket and works it to the end, and the history tells the story', async ({
    page,
    request,
  }) => {
    const customerToken = await apiLogin(request, users.customer1);
    const ticketId = await apiCreateTicket(request, customerToken, uniqueSubject('Lifecycle'));

    await signIn(page, users.agent1);
    await page.goto(`/tickets/${ticketId}`);

    await page.getByRole('button', { name: 'Take ticket' }).click();
    await expect(page.getByText('Sam Support took the ticket')).toBeVisible();
    await expect(page.locator('dd', { hasText: 'Sam Support' })).toBeVisible();

    await page.getByRole('button', { name: 'Mark as in progress' }).click();
    await expect(
      page.getByText('Sam Support changed the status from Open to In progress'),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Mark as resolved' }).click();
    await expect(page.getByText('changed the status from In progress to Resolved')).toBeVisible();

    page.once('dialog', (dialog) => void dialog.accept()); // "Close this ticket?" confirmation
    await page.getByRole('button', { name: 'Close ticket' }).click();
    await expect(page.getByText('changed the status from Resolved to Closed')).toBeVisible();

    await expect(page.getByText('A closed ticket cannot be changed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reply' })).toHaveCount(0);
  });

  test('when two agents race for a ticket, the loser is told and sees the real owner', async ({
    browser,
    request,
  }) => {
    const customerToken = await apiLogin(request, users.customer1);
    const ticketId = await apiCreateTicket(request, customerToken, uniqueSubject('Race'));
    const samContext = await browser.newContext();
    const danaContext = await browser.newContext();

    try {
      const sam = await samContext.newPage();
      const dana = await danaContext.newPage();
      await signIn(sam, users.agent1);
      await signIn(dana, users.agent2);

      // Both agents have the unassigned ticket open, each with a "Take ticket" button.
      await sam.goto(`/tickets/${ticketId}`);
      await dana.goto(`/tickets/${ticketId}`);
      await expect(sam.getByRole('button', { name: 'Take ticket' })).toBeVisible();
      await expect(dana.getByRole('button', { name: 'Take ticket' })).toBeVisible();

      await sam.getByRole('button', { name: 'Take ticket' }).click();
      await expect(sam.getByText('Sam Support took the ticket')).toBeVisible();

      // Dana still sees the stale button. Her click must be refused, and her screen must catch up.
      await dana.getByRole('button', { name: 'Take ticket' }).click();
      await expect(
        dana.getByRole('alert').filter({ hasText: 'already assigned to another agent' }),
      ).toBeVisible();
      await expect(dana.locator('dd', { hasText: 'Sam Support' })).toBeVisible();
      await expect(dana.getByRole('button', { name: 'Take ticket' })).toHaveCount(0);
    } finally {
      await samContext.close();
      await danaContext.close();
    }
  });
});