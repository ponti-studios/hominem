import { expect, test } from './fixtures'

test('mobile webkit renders core authenticated finance surfaces', async ({
  authenticatedPage,
  financeSeed,
}) => {
  void financeSeed
  await authenticatedPage.goto('/finance')
  await expect(authenticatedPage.getByText('Whole Foods Market')).toBeVisible()

  await authenticatedPage.goto('/accounts')
  await expect(authenticatedPage.getByText('Everyday Checking')).toBeVisible()

  await authenticatedPage.goto('/analytics')
  await expect(authenticatedPage.getByRole('heading', { name: 'Analytics' })).toBeVisible()
})
