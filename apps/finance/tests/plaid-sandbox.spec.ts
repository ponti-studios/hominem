import { expect, test } from './fixtures'

test('sandbox Plaid project placeholder is credential gated', async ({ authenticatedPage }) => {
  test.skip(
    !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || process.env.PLAID_ENV !== 'sandbox',
    'Plaid sandbox credentials are not configured for this local run.',
  )

  await authenticatedPage.goto('/accounts')
  await expect(authenticatedPage.getByRole('button', { name: /Add Bank Account|Connect/ })).toBeVisible()
})
