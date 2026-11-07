import { expect, test, type Page } from '@playwright/test';

/**
 * Persona: Maya Chen, freelance product designer.
 *
 * Monday, 8:05am. Coffee in hand, twelve minutes before her first client call.
 * She does a Monday money review: how the month is pacing, where the money
 * went, whether the checking account matches reality, how long the cash lasts,
 * and whether she can buy the £2,400 studio chair she has been eyeing.
 *
 * This spec exists to record that journey end to end. It is read-only: no
 * finance record is created, edited, or deleted.
 */

test.use({
  video: 'on',
  viewport: { width: 1280, height: 800 },
  launchOptions: { slowMo: 220 },
});

test.setTimeout(180_000);

async function go(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test('Maya’s Monday money review', async ({ page }) => {
  test.info().annotations.push({
    type: 'persona',
    description: 'Maya Chen, freelance product designer, Monday 8:05am money review',
  });

  // 08:05 — How is the month pacing?
  await test.step('Overview: month-to-date pace and account balances', async () => {
    await go(page, '/finance');
    await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spending pace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    await page.waitForTimeout(900);
  });

  // 08:07 — Where did it go?
  await test.step('Analytics: income, expenses, and top merchants', async () => {
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Analytics', exact: true })).toBeVisible();
    await expect(page.getByText('TOTAL EXPENSES')).toBeVisible();

    await page.getByRole('button', { name: 'Bar', exact: true }).click();
    await page.getByRole('heading', { name: 'Top Merchants' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
  });

  // 08:09 — Does checking match what she thinks?
  await test.step('Everyday Checking: balance and recent activity', async () => {
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page
      .getByRole('link', { name: /Everyday Checking/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Everyday Checking', exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(900);
  });

  // 08:11 — How long does the cash last?
  await test.step('Runway: live cash trajectory', async () => {
    await page.getByRole('link', { name: 'Runway', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Financial Runway Calculator' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live trajectory' })).toBeVisible();
    await page.waitForTimeout(900);
  });

  // 08:13 — What needs a true-up?
  await test.step('Reconcile: inspect the checking ledger', async () => {
    await page.getByRole('link', { name: 'Reconcile', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reconciliation staleness' })).toBeVisible();
    await page
      .getByRole('row', { name: /Everyday Checking/ })
      .getByRole('link', { name: 'Ledger' })
      .click();
    await expect(page.getByText('Ledger breakdown')).toBeVisible();
    await page.waitForTimeout(900);
  });

  // 08:15 — Any transfers counted twice?
  await test.step('Transfers: widen the detection window', async () => {
    await page.getByRole('link', { name: 'Transfers', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Transfer pairs' })).toBeVisible();
    await page.getByLabel('Min amount').fill('25');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForTimeout(900);
  });

  // 08:17 — The chair.
  await test.step('Afford it?: the £2,400 studio chair', async () => {
    await page.getByRole('link', { name: 'Afford it?', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Can I Afford This?' })).toBeVisible();

    await page.getByLabel('Purchase amount ($)').fill('2400');
    await page.getByLabel('Current balance ($)').fill('6105');
    await page.getByLabel('Monthly income ($)').fill('15717');
    await page.getByLabel('Monthly expenses ($)').fill('6638');

    const check = page.getByRole('button', { name: 'Check affordability' });
    await expect(check).toBeEnabled();
    await check.click();

    await expect(page.getByText('Verdict')).toBeVisible();
    await expect(page.getByText('Balance after purchase')).toBeVisible();
    await page.waitForTimeout(1400);
  });

  // 08:19 — How much is the bookshop habit, really?
  await test.step('Search: the bookshop charges', async () => {
    await page.getByRole('link', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Search transactions and accounts' }).click();
    const search = page.getByRole('textbox', { name: 'Search transactions and accounts' });
    await search.fill('bookshop');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.waitForTimeout(900);
    await search.press('Enter');
    await expect(page).toHaveURL(/\/finance\?search=bookshop/i);
    await page.waitForTimeout(900);
  });
});
