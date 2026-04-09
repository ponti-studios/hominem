import type { Page } from '@playwright/test';

import { expect, test } from './authenticated-test';

async function createNote(page: Page) {
  await page.goto('/notes');

  const composer = page.getByLabel('Compose message or note');
  await expect(composer).toBeVisible({ timeout: 5_000 });
  const noteTitle = `Draft note for assistant flow ${Date.now()}`;
  await composer.fill(noteTitle);
  await page.getByRole('button', { name: 'Save note' }).click();

  const createdNoteLink = page.getByRole('link', { name: new RegExp(noteTitle, 'i') });
  await expect(createdNoteLink).toBeVisible({ timeout: 5_000 });
  await createdNoteLink.click();

  await expect(page).toHaveURL(/\/notes\/[^/?#]+$/, { timeout: 5_000 });
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel('Note content')).toBeVisible({ timeout: 5_000 });

  return page.url().split('/').pop()?.split('?')[0] ?? '';
}

test.describe('Notes critical path', () => {
  test('authenticated user reaches the notes index', async ({ page }) => {
    await page.goto('/notes');

    await expect(page).toHaveURL(/\/notes$/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByLabel('Compose message or note')).toBeVisible({ timeout: 5_000 });
  });

  test('creating a note opens the editor', async ({ page }) => {
    await createNote(page);
  });

  test('attaching a file keeps the user on the note editor', async ({ page }) => {
    await createNote(page);

    await page.locator('input[type="file"]').setInputFiles({
      name: 'note-attachment.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Attachment for note flow'),
    });

    await expect(page.getByText('note-attachment.txt')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/notes\/[^/?#]+$/, { timeout: 5_000 });
  });

  test('chat with this note opens a chat session with note context', async ({ page }) => {
    const noteId = await createNote(page);

    await page.getByRole('link', { name: 'Chat with this note' }).click();
    await expect(page).toHaveURL(new RegExp(`/chat\\?noteId=${noteId}$`), { timeout: 5_000 });
    await expect(page.getByText('This chat can start with note context from')).toBeVisible({
      timeout: 5_000,
    });

    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/[^/?#]+\\?noteId=${noteId}$`), {
      timeout: 5_000,
    });

    await expect(page.getByRole('heading', { name: 'Selected notes' })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: /untitled note/i })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: 'Dictate chat message' })).toBeVisible({
      timeout: 5_000,
    });
  });
});
