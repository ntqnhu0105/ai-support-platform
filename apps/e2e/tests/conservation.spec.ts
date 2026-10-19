import { expect, test } from './fixtures';
import { signIn, uniqueSubject, users } from './helpers';

test.describe('conversation', () => {
  test('a customer and an agent talk, and internal notes stay internal', async ({ browser }) => {
    const subject = uniqueSubject('Withdrawal pending');
    const customerContext = await browser.newContext();
    const agentContext = await browser.newContext();

    try {
      const customer = await customerContext.newPage();
      const agent = await agentContext.newPage();

      // The customer opens a ticket through the form.
      await signIn(customer, users.customer1);
      await customer.getByRole('link', { name: 'New ticket' }).click();
      await customer.getByLabel('Subject').fill(subject);
      await customer
        .getByLabel('Description')
        .fill('My withdrawal has been pending for three days.');
      await customer.getByRole('button', { name: 'Submit ticket' }).click();
      await expect(customer).toHaveURL(/\/tickets\/[0-9a-f-]{36}$/);
      await expect(customer.getByRole('heading', { name: subject })).toBeVisible();
      const ticketUrl = customer.url();

      // The agent answers publicly, then leaves a note only staff can read.
      await signIn(agent, users.agent1);
      await agent.goto(ticketUrl);
      await expect(agent.getByRole('heading', { name: subject })).toBeVisible();

      await agent.getByLabel('Reply', { exact: true }).fill('We are looking into it.');
      await agent.getByRole('button', { name: 'Send reply' }).click();
      await expect(agent.getByText('We are looking into it.')).toBeVisible();

      await agent.getByLabel('Internal note, hidden from the customer').check();
      await agent
        .getByLabel('Internal note (the customer will not see this)')
        .fill('The partner bank batch failed on Tuesday.');
      await agent.getByRole('button', { name: 'Add note' }).click();
      await expect(agent.getByText('The partner bank batch failed on Tuesday.')).toBeVisible();

      // The customer sees the public reply, and never the internal note.
      await customer.reload();
      await expect(customer.getByText('We are looking into it.')).toBeVisible();
      await expect(customer.getByText('partner bank batch')).toHaveCount(0);
    } finally {
      await customerContext.close();
      await agentContext.close();
    }
  });

  test('a customer reply puts a ticket that was waiting for them back in progress', async ({
    page,
  }) => {
    await signIn(page, users.customer3);
    await page.getByRole('link', { name: 'Cannot log in after changing phone' }).click();
await expect(
  page.getByText('Waiting customer', { exact: true }).last(),
).toBeVisible();    await page
      .getByLabel('Reply', { exact: true })
      .fill('My ID ends with 1234 and I was born in 1999.');
    await page.getByRole('button', { name: 'Send reply' }).click();

    await expect(page.getByText('My ID ends with 1234 and I was born in 1999.')).toBeVisible();
    await expect(page.getByText('In progress')).toBeVisible();
  });
});