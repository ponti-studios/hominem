import type { Page } from '@playwright/test';

import { expect, test } from './authenticated-test';

const CHAT_INPUT_PLACEHOLDER = 'Ask something, mention a note with #, or paste text from a file.';

async function openNewChat(page: Page) {
  await page.goto('/chat');

  await page.getByRole('button', { name: 'New chat' }).click();
  await expect(page).toHaveURL(/\/chat\/[^/?#]+(?:\?.*)?$/, { timeout: 5_000 });

  const textarea = page.getByPlaceholder(CHAT_INPUT_PLACEHOLDER);
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  return textarea;
}

test.describe('Chat UI', () => {
  test('shows an empty draft when a new chat opens', async ({ page }) => {
    const textarea = await openNewChat(page);
    await expect(textarea).toHaveValue('');
  });

  test('shows note context guidance before notes are attached', async ({ page }) => {
    await openNewChat(page);
    await expect(page.getByText('Type # in the composer to search notes.')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('attachment button uploads a file before send', async ({ page }) => {
    await openNewChat(page);

    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: 'chat-attachment.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Attachment for chat flow'),
      });

    await expect(page.getByText('chat-attachment.txt')).toBeVisible({ timeout: 5_000 });
  });

  test('voice input button is visible in the chat toolbar', async ({ page }) => {
    await openNewChat(page);
    await expect(page.getByRole('button', { name: 'Dictate chat message' })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('new chat shows empty-state guidance before any message is sent', async ({ page }) => {
    await openNewChat(page);
    await expect(page.getByText('No messages yet.')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Ask a question, mention notes with')).toBeVisible({
      timeout: 5_000,
    });
  });
});
