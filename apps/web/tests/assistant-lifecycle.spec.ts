import type { Page } from '@playwright/test';

import { expect, test } from './authenticated-test';

async function createNote(page: Page) {
  await page.goto('/notes');

  const composer = page.getByLabel('Compose message or note');
  await expect(composer).toBeVisible({ timeout: 5_000 });
  const noteTitle = `Draft note for assistant flow ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await composer.fill(noteTitle);
  await page.getByRole('button', { name: 'Save note' }).click();

  const createdNoteLink = page.getByRole('link', { name: new RegExp(noteTitle, 'i') }).first();
  await expect(createdNoteLink).toBeVisible({ timeout: 5_000 });
  await expect(createdNoteLink).toHaveAttribute('href', /\/notes\/(?!optimistic-note-)[^/?#]+$/, {
    timeout: 5_000,
  });

  const noteHref = await createdNoteLink.getAttribute('href');
  if (!noteHref) {
    throw new Error('Created note link is missing an href');
  }

  await page.goto(noteHref);

  await expect(page).toHaveURL(/\/notes\/[^/?#]+$/, { timeout: 5_000 });
  await expect(page.getByLabel('Note title')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel('Note content')).toBeVisible({ timeout: 5_000 });

  return {
    noteId: page.url().split('/').pop()?.split('?')[0] ?? '',
    noteTitle,
  };
}

async function attachNoteFile(page: Page, filename: string, content: string) {
  await page.getByTestId('note-file-input').setInputFiles({
    name: filename,
    mimeType: 'text/plain',
    buffer: Buffer.from(content),
  });

  await expect(page.getByText(filename)).toBeVisible({ timeout: 10_000 });
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
    const { noteId } = await createNote(page);

    await attachNoteFile(page, 'note-attachment.txt', 'Attachment for note flow');

    await expect(page.getByText('note-attachment.txt')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/notes\/[^/?#]+$/, { timeout: 5_000 });

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/notes/${noteId}$`), { timeout: 5_000 });
    await expect(page.getByText('note-attachment.txt')).toBeVisible({ timeout: 10_000 });
  });

  test('chat with this note opens a chat session with note context', async ({ page }) => {
    const { noteId, noteTitle } = await createNote(page);

    await page.getByRole('link', { name: 'Chat with this note' }).click();
    await expect(page).toHaveURL(new RegExp(`/chat\\?noteId=${noteId}$`), { timeout: 5_000 });
    await expect(page.getByText('This chat can start with note context from')).toBeVisible({
      timeout: 5_000,
    });

    await page.getByRole('button', { name: 'New chat' }).click();
    await expect(page).toHaveURL(new RegExp(`/chat/[^/?#]+\\?noteId=${noteId}$`), {
      timeout: 5_000,
    });

    const selectedNotesSection = page.getByRole('heading', { name: 'Selected notes' }).locator('..');
    await expect(selectedNotesSection).toBeVisible({
      timeout: 5_000,
    });
    await expect(selectedNotesSection.getByText(noteTitle)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Dictate chat message' })).toBeVisible({
      timeout: 5_000,
    });
  });
});
