import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/hominem finance/i);
  const homepage = page.frameLocator('iframe[title="Hominem Finance homepage"]');
  await expect(
    homepage.getByRole('heading', {
      level: 1,
      name: /give your muse a/i,
    }),
  ).toBeVisible();
  await expect(homepage.getByRole('link', { name: 'Get started' }).first()).toHaveAttribute(
    'href',
    '/auth',
  );
});
