import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import {
  createNoteFeedRows,
  expectFirstNoteFeedPage,
  expectSecondNoteFeedPage,
} from '../../test/note-feed';
import { db, pool } from '../../db';
import { getDb, runInTransaction } from '../../transaction';
import { NoteRepository } from './note.repository';

const testUserId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const testFileId = '11111111-1111-4111-8111-111111111111';

const TABLES = ['app.note_files', 'app.files', 'app.notes', '"user"'] as const;

async function resetDb() {
  await pool.query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function seedUser(id: string, email: string) {
  await db
    .insertInto('user')
    .values({ id, email, name: 'Test User', emailVerified: true })
    .execute();
}

async function seedFile(id: string, ownerUserId: string) {
  await db
    .insertInto('app.files')
    .values({
      id,
      owner_userid: ownerUserId,
      storage_key: `uploads/${ownerUserId}/${id}`,
      original_name: 'test.txt',
      mimetype: 'text/plain',
      size: 100,
      url: `https://example.com/${id}`,
    })
    .execute();
}

beforeAll(async () => {
  await resetDb();
  await seedUser(testUserId, 'repo-test@hominem.test');
  await seedUser(otherUserId, 'repo-other@hominem.test');
});

afterEach(async () => {
  await pool.query('TRUNCATE TABLE app.note_files, app.files, app.notes RESTART IDENTITY CASCADE');
});

describe('NoteRepository', () => {
  test('create and load a note', async () => {
    const handle = getDb();

    const row = await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Test Note',
      content: 'Hello world',
      excerpt: 'Hello',
    });

    expect(row.id).toBeTruthy();

    const loaded = await NoteRepository.load(handle, row.id, testUserId);
    expect(loaded.title).toBe('Test Note');
    expect(loaded.content).toBe('Hello world');
    expect(loaded.userId).toBe(testUserId);
    expect(loaded.files).toEqual([]);
  });

  test('ownership enforcement', async () => {
    const handle = getDb();
    const row = await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Private',
      content: 'Secret',
      excerpt: null,
    });

    await expect(NoteRepository.load(handle, row.id, otherUserId)).rejects.toThrow('Note');

    const loaded = await NoteRepository.load(handle, row.id, testUserId);
    expect(loaded.title).toBe('Private');
  });

  test('create with files inside transaction', async () => {
    await seedFile(testFileId, testUserId);

    const note = await runInTransaction(async (trx) => {
      const row = await NoteRepository.create(trx, {
        userId: testUserId,
        title: 'With File',
        content: 'Attached file test',
        excerpt: null,
      });

      await NoteRepository.syncFiles(trx, row.id, testUserId, [testFileId]);
      return NoteRepository.load(trx, row.id, testUserId);
    });

    expect(note.files).toHaveLength(1);
    expect(note.files[0]!.originalName).toBe('test.txt');
  });

  test('syncFiles rejects unowned files', async () => {
    await seedFile(testFileId, otherUserId);

    const handle = getDb();
    const row = await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Bad files',
      content: 'test',
      excerpt: null,
    });

    await expect(
      NoteRepository.syncFiles(handle, row.id, testUserId, [testFileId]),
    ).rejects.toThrow('unavailable');
  });

  test('list and search', async () => {
    const handle = getDb();

    await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Alpha',
      content: 'First note',
      excerpt: 'First',
    });
    await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Beta',
      content: 'Second note',
      excerpt: 'Second',
    });
    await NoteRepository.create(handle, {
      userId: otherUserId,
      title: 'Gamma',
      content: 'Other user note',
      excerpt: 'Other',
    });

    const allNotes = await NoteRepository.list(handle, { userId: testUserId });
    expect(allNotes).toHaveLength(2);

    const searched = await NoteRepository.search(handle, {
      userId: testUserId,
      query: 'First',
    });
    expect(searched).toHaveLength(1);
    expect(searched[0]!.title).toBe('Alpha');
  });

  test('lists feed pages in reverse chronological order with cursor pagination', async () => {
    const handle = getDb();

    await db.insertInto('app.notes').values(createNoteFeedRows(testUserId)).execute();

    const firstPage = await NoteRepository.listFeed(handle, {
      userId: testUserId,
      limit: 2,
    });

    expectFirstNoteFeedPage(firstPage);

    const secondPage = await NoteRepository.listFeed(handle, {
      userId: testUserId,
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });

    expectSecondNoteFeedPage(secondPage);
  });

  test('update and delete', async () => {
    const handle = getDb();

    const row = await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Original',
      content: 'Before',
      excerpt: null,
    });

    await NoteRepository.update(handle, row.id, testUserId, {
      title: 'Updated',
      content: 'After',
    });

    const updated = await NoteRepository.load(handle, row.id, testUserId);
    expect(updated.title).toBe('Updated');
    expect(updated.content).toBe('After');

    await NoteRepository.hardDelete(handle, row.id, testUserId);

    await expect(NoteRepository.load(handle, row.id, testUserId)).rejects.toThrow('Note');
  });

  test('archive and unarchive keep notes in the database but toggle visibility', async () => {
    const handle = getDb();

    const row = await NoteRepository.create(handle, {
      userId: testUserId,
      title: 'Archived',
      content: 'Hidden note',
      excerpt: null,
    });

    await NoteRepository.archive(handle, row.id, testUserId);

    await expect(NoteRepository.load(handle, row.id, testUserId)).rejects.toThrow('Note');

    const listedAfterArchive = await NoteRepository.list(handle, { userId: testUserId });
    expect(listedAfterArchive.map((note) => note.id)).not.toContain(row.id);

    await NoteRepository.unarchive(handle, row.id, testUserId);

    const restored = await NoteRepository.load(handle, row.id, testUserId);
    expect(restored.title).toBe('Archived');

    const listedAfterRestore = await NoteRepository.list(handle, { userId: testUserId });
    expect(listedAfterRestore.map((note) => note.id)).toContain(row.id);
  });
});
