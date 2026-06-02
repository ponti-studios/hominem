import { test, expect } from '@playwright/test'

test.describe('Portfolio editor (with test auth cookie)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    const testUser = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      name: 'Test User',
    }
    await page.context().addCookies([
      {
        name: 'test-auth-user',
        value: encodeURIComponent(JSON.stringify(testUser)),
        url: 'http://localhost:4451',
      },
    ])
  })

  test('should load the editor and show the user name', async ({ page }) => {
    await page.goto('/editor')
    await expect(page.getByText('Portfolio Editor')).toBeVisible()
  })
})
