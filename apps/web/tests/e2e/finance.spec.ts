import { expect, test, type Page } from '@playwright/test';

async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test('finance sub-app renders every surface from the platform shell', async ({ page }) => {
  const surfaces: Array<[string, string]> = [
    ['/finance', 'Finance'],
    ['/finance/analytics', 'Analytics'],
    ['/finance/accounts', 'Accounts'],
    ['/finance/runway', 'Financial Runway Calculator'],
    ['/finance/affordability', 'Can I Afford This?'],
    ['/finance/reconcile', 'Reconcile'],
    ['/finance/transfers', 'Transfer pairs'],
  ];

  for (const [path, heading] of surfaces) {
    await go(page, path);
    await expect(page.getByRole('navigation', { name: 'Finance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }

  await go(page, '/finance');
  const links = page.getByRole('navigation', { name: 'Finance' }).getByRole('link');
  await expect(links).toHaveCount(7);
});

test('the finance search dialog opens and accepts a query', async ({ page }) => {
  await go(page, '/finance');
  await page.getByRole('button', { name: 'Search transactions and accounts' }).click();
  const input = page.getByRole('textbox', { name: 'Search transactions and accounts' });
  await expect(input).toBeVisible();
  await input.fill('coffee');
  await expect(input).toHaveValue('coffee');
});

test('cross-domain navigation keeps one shell', async ({ page }) => {
  await go(page, '/tasks');
  await expect(page.getByRole('navigation', { name: 'Domains' })).toBeVisible();

  await page.getByRole('link', { name: 'Finance', exact: true }).click();
  await expect(page).toHaveURL(/\/finance$/);

  await page.getByRole('link', { name: 'Career', exact: true }).click();
  await expect(page).toHaveURL(/\/career$/);

  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test('finance navigation stays within a performance budget', async ({ page }) => {
  await go(page, '/finance');
  const duration = await page.evaluate(
    () => performance.getEntriesByType('navigation')[0]?.duration ?? 0,
  );

  test
    .info()
    .annotations.push({ type: 'navigation-ms', description: String(Math.round(duration)) });
  expect(duration).toBeLessThan(4000);
});
