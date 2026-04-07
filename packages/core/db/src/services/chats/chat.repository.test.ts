import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { db, pool } from '../../db';
import { getDb } from '../../transaction';
import { FileRepository } from '../files/file.repository';
import { NoteRepository } from '../notes/note.repository';
import { ChatRepository } from './chat.repository';

const ownerUserId = '00000000-0000-4000-8000-000000000011';
const otherUserId = '00000000-0000-4000-8000-000000000012';
const noteFileId = '11111111-1111-4111-8111-111111111111';
const chatFileId = '11111111-1111-4111-8111-111111111112';

const TABLES = [
  'app.chat_messages',
  'app.note_files',
  'app.files',
  'app.notes',
  'app.chats',
] as const;

async function resetDb() {
  await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function cleanupUsers() {
  await db.deleteFrom('user').where('id', 'in', [ownerUserId, otherUserId]).execute();
}

async function seedUser(id: string, email: string) {
  await db
    .insertInto('user')
    .values({ id, email, name: 'Test User', emailVerified: true })
    .execute();
}

beforeAll(async () => {
  await resetDb();
  await cleanupUsers();
  await seedUser(ownerUserId, 'chat-repo-owner@hominem.test');
  await seedUser(otherUserId, 'chat-repo-other@hominem.test');
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await cleanupUsers();
});

describe('ChatRepository', () => {
  test('creates chats with note links and excludes archived chats from lists', async () => {
    const handle = getDb();

    const note = await NoteRepository.create(handle, {
      userId: ownerUserId,
      title: 'Project Note',
      content: 'linked content',
      excerpt: 'linked',
    });

    const activeChat = await ChatRepository.create(handle, {
      userId: ownerUserId,
      title: 'Active Chat',
    });
    const linkedChat = await ChatRepository.create(handle, {
      userId: ownerUserId,
      title: 'Linked Chat',
      noteId: note.id,
      archivedAt: '2026-05-19T00:00:00.000Z',
    });

    expect(linkedChat.noteId).toBe(note.id);
    expect(linkedChat.archivedAt).toContain('2026-05-19');

    const byNote = await ChatRepository.getByNoteId(handle, note.id, ownerUserId);
    expect(byNote?.id).toBe(linkedChat.id);
    expect(await ChatRepository.getByNoteId(handle, note.id, otherUserId)).toBeNull();

    const listed = await ChatRepository.listForUser(handle, ownerUserId);
    expect(listed.map((chat) => chat.id)).toContain(activeChat.id);
    expect(listed.map((chat) => chat.id)).not.toContain(linkedChat.id);
  });

  test('enriches messages and note context, then clears chat messages', async () => {
    const handle = getDb();

    const noteFile = await FileRepository.upsert(handle, {
      id: noteFileId,
      userId: ownerUserId,
      storageKey: `uploads/${ownerUserId}/${noteFileId}`,
      originalName: 'project-note.txt',
      mimetype: 'text/plain',
      size: 128,
      url: `https://example.com/${noteFileId}`,
      content: 'Attached note file',
      textContent: 'Attached note file',
    });

    const note = await NoteRepository.create(handle, {
      userId: ownerUserId,
      title: 'Project Plan',
      content: 'Plan body',
      excerpt: 'Plan',
    });

    await NoteRepository.syncFiles(handle, note.id, ownerUserId, [noteFile.id]);

    const chat = await ChatRepository.create(handle, {
      userId: ownerUserId,
      title: 'Conversation',
    });

    await ChatRepository.insertMessage(handle, {
      chatId: chat.id,
      authorUserId: ownerUserId,
      role: 'user',
      content: 'Please review #project-plan',
      referencedNoteIds: [note.id],
    });

    const messages = await ChatRepository.getMessages(handle, chat.id);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.referencedNotes).toEqual([
      {
        id: note.id,
        title: 'Project Plan',
      },
    ]);

    const contexts = await ChatRepository.resolveReferencedNotes(
      handle,
      ownerUserId,
      [note.id],
      'Please review #project-plan',
    );
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.id).toBe(note.id);
    expect(contexts[0]?.files).toHaveLength(1);
    expect(contexts[0]?.files[0]?.originalName).toBe('project-note.txt');

    const cleared = await ChatRepository.clearMessages(handle, chat.id, ownerUserId);
    expect(cleared).toBe(true);
    expect(await ChatRepository.getMessages(handle, chat.id)).toHaveLength(0);
  });

  test('resolves chat files with ownership checks', async () => {
    const handle = getDb();

    const ownedFile = await FileRepository.upsert(handle, {
      id: chatFileId,
      userId: ownerUserId,
      storageKey: `uploads/${ownerUserId}/${chatFileId}`,
      originalName: 'attachment.txt',
      mimetype: 'text/plain',
      size: 42,
      url: `https://example.com/${chatFileId}`,
      content: 'Attachment body',
      textContent: 'Attachment body',
    });

    const otherFile = await FileRepository.upsert(handle, {
      id: '11111111-1111-4111-8111-111111111113',
      userId: otherUserId,
      storageKey: `uploads/${otherUserId}/11111111-1111-4111-8111-111111111113`,
      originalName: 'other.txt',
      mimetype: 'text/plain',
      size: 24,
      url: 'https://example.com/11111111-1111-4111-8111-111111111113',
    });

    const resolved = await ChatRepository.resolveChatFiles(handle, ownerUserId, [ownedFile.id]);
    expect(resolved).toEqual([
      expect.objectContaining({
        fileId: ownedFile.id,
        filename: 'attachment.txt',
        mimeType: 'text/plain',
        type: 'file',
      }),
    ]);

    await expect(
      ChatRepository.resolveChatFiles(handle, ownerUserId, [otherFile.id]),
    ).rejects.toThrow('unavailable');
  });
});
