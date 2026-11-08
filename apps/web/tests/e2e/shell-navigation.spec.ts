import { expect, test } from '@playwright/test';

/**
 * Shell regression: the Obsidian Volt platform chrome.
 * Sidebar + topbar landmarks, command palette grouping/filter, finance
 * sub-nav, and the mobile tab bar. Screenshots land in test-results/.
 */
test('platform shell navigation', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: 'What needs doing' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Domains' }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/dark-shell-tasks.png' });

  // Command palette
  await page.keyboard.press('Meta+K');
  await expect(page.getByRole('dialog', { name: 'Jump anywhere' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dark-shell-palette.png' });
  await page.keyboard.type('runway');
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/dark-shell-palette-runway.png' });
  await page.keyboard.press('Escape');

  // Finance sub-nav pills
  await page.goto('/finance');
  await expect(page.getByRole('navigation', { name: 'Finance' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Domains' }).first()).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/dark-shell-finance.png' });

  // Mobile tab bar
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: 'What needs doing' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dark-shell-mobile.png' });
});
