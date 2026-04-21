import type { JsonValue } from '@hakumi/db';
import { db, pool } from '@hakumi/db';

const RPC_TEST_TABLES = [
  'app.chat_messages',
  'app.chats',
  'app.note_files',
  'app.files',
  'app.notes',
  '"user"',
] as const;

export async function resetTestDb() {
  await pool.query(`TRUNCATE TABLE ${RPC_TEST_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function seedTestUser(input: { id: string; email: string; name?: string }) {
  await db
    .insertInto('user')
    .values({
      id: input.id,
      email: input.email,
      name: input.name ?? 'Test User',
      emailVerified: true,
    })
    .execute();
}

export async function seedNote(input: {
  id: string;
  ownerUserId: string;
  title?: string | null;
  content?: string;
  excerpt?: string | null;
}) {
  await db
    .insertInto('app.notes')
    .values({
      id: input.id,
      owner_userid: input.ownerUserId,
      title: input.title ?? null,
      content: input.content ?? '',
      excerpt: input.excerpt ?? null,
    })
    .execute();
}

export async function seedFile(input: {
  id: string;
  ownerUserId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  content?: string | null;
  textContent?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  await db
    .insertInto('app.files')
    .values({
      id: input.id,
      owner_userid: input.ownerUserId,
      storage_key: input.storageKey,
      original_name: input.originalName,
      mimetype: input.mimetype,
      size: input.size,
      url: input.url,
      content: input.content ?? null,
      text_content: input.textContent ?? null,
      metadata: (input.metadata ?? null) as JsonValue | null,
    })
    .execute();
}

export async function attachFileToNote(input: { noteId: string; fileId: string }) {
  await db
    .insertInto('app.note_files')
    .values({
      note_id: input.noteId,
      file_id: input.fileId,
    })
    .execute();
}

export async function seedChat(input: {
  id: string;
  ownerUserId: string;
  title: string;
  noteId?: string | null;
}) {
  await db
    .insertInto('app.chats')
    .values({
      id: input.id,
      owner_userid: input.ownerUserId,
      title: input.title,
      note_id: input.noteId ?? null,
    })
    .execute();
}
