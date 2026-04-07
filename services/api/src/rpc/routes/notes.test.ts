import type { User } from '@hominem/auth/server';
import { db } from '@hominem/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { resetTestDb, seedFile, seedTestUser } from '../../../test/test-db';
import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { notesRoutes } from './notes';
import { createTestApp, createTestUser, patchJson, postJson } from './test-helpers';

const testUserId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const testFileId = '11111111-1111-4111-8111-111111111111';
const nowIso = '2026-04-02T12:00:00.000Z';

function createApp() {
  const app = createTestApp(testUserId);
  app.route('/api/notes', notesRoutes);
  return app;
}

describe('notesRoutes', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedTestUser({
      id: testUserId,
      email: 'notes-test@hominem.test',
    });
    await seedTestUser({
      id: otherUserId,
      email: 'other-notes-test@hominem.test',
    });
  });

  afterEach(async () => {
    await resetTestDb();
  });

  test('creates a note and attaches owned files', async () => {
    await seedFile({
      id: testFileId,
      ownerUserId: testUserId,
      storageKey: `${testUserId}/${testFileId}-brief.txt`,
      originalName: 'brief.txt',
      mimetype: 'text/plain',
      size: 24,
      url: 'https://cdn.example.com/brief.txt',
      textContent: 'Brief context',
    });

    const response = await postJson(createApp(), '/api/notes', {
      title: 'Project Brief',
      content: 'Project Brief\nBody copy',
      fileIds: [testFileId],
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      id: string;
      title: string | null;
      files: Array<{ id: string; originalName: string }>;
    };

    expect(body.title).toBe('Project Brief');
    expect(body.files).toMatchObject([{ id: testFileId, originalName: 'brief.txt' }]);

    const attached = await db
      .selectFrom('app.note_files')
      .selectAll()
      .where('note_id', '=', body.id)
      .execute();

    expect(attached).toHaveLength(1);
    expect(attached[0]?.file_id).toBe(testFileId);
  });

  test('lists only notes owned by the authenticated user', async () => {
    await db
      .insertInto('app.notes')
      .values([
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          owner_userid: testUserId,
          title: 'Visible note',
          content: 'Visible body',
        },
        {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          owner_userid: otherUserId,
          title: 'Hidden note',
          content: 'Hidden body',
        },
      ])
      .execute();

    const response = await createApp().request('http://localhost/api/notes', {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { notes: Array<{ id: string; title: string | null }> };
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0]).toMatchObject({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      title: 'Visible note',
    });
  });

  test('lists feed items with cursor pagination', async () => {
    await db
      .insertInto('app.notes')
      .values([
        {
          id: '11111111-1111-4111-8111-111111111111',
          owner_userid: testUserId,
          title: 'Newest',
          content: 'Newest body',
          createdat: new Date('2026-04-02T12:02:00.000Z'),
          updatedat: new Date('2026-04-02T12:02:00.000Z'),
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          owner_userid: testUserId,
          title: 'Middle',
          content: 'Middle body',
          createdat: new Date('2026-04-02T12:01:00.000Z'),
          updatedat: new Date('2026-04-02T12:01:00.000Z'),
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          owner_userid: testUserId,
          title: 'Oldest',
          content: 'Oldest body',
          createdat: new Date('2026-04-02T12:00:00.000Z'),
          updatedat: new Date('2026-04-02T12:00:00.000Z'),
        },
      ])
      .execute();

    const firstResponse = await createApp().request('http://localhost/api/notes/feed?limit=2', {
      method: 'GET',
    });

    expect(firstResponse.status).toBe(200);
    const firstPage = (await firstResponse.json()) as {
      notes: Array<{ id: string; contentPreview: string }>;
      nextCursor: string | null;
    };

    expect(firstPage.notes.map((note) => note.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
    expect(firstPage.notes[0]?.contentPreview).toBe('Newest body');
    expect(firstPage.nextCursor).toBeTruthy();

    const secondResponse = await createApp().request(
      `http://localhost/api/notes/feed?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`,
      {
        method: 'GET',
      },
    );

    expect(secondResponse.status).toBe(200);
    const secondPage = (await secondResponse.json()) as {
      notes: Array<{ id: string }>;
      nextCursor: string | null;
    };

    expect(secondPage.notes.map((note) => note.id)).toEqual([
      '33333333-3333-4333-8333-333333333333',
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('updates note attachments with real file ownership checks', async () => {
    const noteId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    await db
      .insertInto('app.notes')
      .values({
        id: noteId,
        owner_userid: testUserId,
        title: 'Draft',
        content: 'Old body',
      })
      .execute();

    await seedFile({
      id: testFileId,
      ownerUserId: testUserId,
      storageKey: `${testUserId}/${testFileId}-brief.txt`,
      originalName: 'brief.txt',
      mimetype: 'text/plain',
      size: 24,
      url: 'https://cdn.example.com/brief.txt',
    });

    const response = await patchJson(createApp(), `/api/notes/${noteId}`, {
      content: 'New body',
      fileIds: [testFileId],
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      content: string;
      files: Array<{ id: string }>;
    };

    expect(body.content).toBe('New body');
    expect(body.files).toMatchObject([{ id: testFileId }]);
  });
});
