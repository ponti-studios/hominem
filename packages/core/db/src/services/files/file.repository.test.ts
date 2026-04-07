import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

import { db, pool } from '../../db';
import { FileRepository } from './file.repository';

const ownerUserId = '00000000-0000-4000-8000-000000000021';
const otherUserId = '00000000-0000-4000-8000-000000000022';
const ownedFileId = '22222222-2222-4222-8222-222222222221';
const otherFileId = '22222222-2222-4222-8222-222222222222';

const TABLES = ['app.files'] as const;

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
  await seedUser(ownerUserId, 'file-repo-owner@hominem.test');
  await seedUser(otherUserId, 'file-repo-other@hominem.test');
});

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await cleanupUsers();
});

describe('FileRepository', () => {
  test('upserts files, derives type, and enforces ownership', async () => {
    const handle = db;

    const file = await FileRepository.upsert(handle, {
      id: ownedFileId,
      userId: ownerUserId,
      storageKey: `uploads/${ownerUserId}/${ownedFileId}`,
      originalName: 'report.pdf',
      mimetype: 'application/pdf',
      size: 2048,
      url: `https://example.com/${ownedFileId}`,
      content: 'Summary body',
      textContent: 'Summary body',
      metadata: { pages: 3 },
    });

    expect(file.type).toBe('document');
    expect(file.content).toBe('Summary body');
    expect(file.textContent).toBe('Summary body');
    expect(file.metadata).toEqual({ pages: 3 });

    const listed = await FileRepository.listForUser(handle, ownerUserId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(ownedFileId);

    expect(await FileRepository.getUrl(handle, ownedFileId, ownerUserId)).toBe(
      `https://example.com/${ownedFileId}`,
    );

    await expect(FileRepository.getOwnedOrThrow(handle, ownedFileId, otherUserId)).rejects.toThrow(
      'File',
    );
  });

  test('deletes files and reports existence correctly', async () => {
    const handle = db;

    await FileRepository.upsert(handle, {
      id: otherFileId,
      userId: ownerUserId,
      storageKey: `uploads/${ownerUserId}/${otherFileId}`,
      originalName: 'image.png',
      mimetype: 'image/png',
      size: 512,
      url: `https://example.com/${otherFileId}`,
    });

    expect(await FileRepository.existsForUser(handle, otherFileId, ownerUserId)).toBe(true);

    await FileRepository.delete(handle, otherFileId, ownerUserId);

    expect(await FileRepository.existsForUser(handle, otherFileId, ownerUserId)).toBe(false);
    await expect(FileRepository.getOwnedOrThrow(handle, otherFileId, ownerUserId)).rejects.toThrow(
      'File',
    );
  });
});
