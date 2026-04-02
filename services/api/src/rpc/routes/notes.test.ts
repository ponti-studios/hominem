import type { User } from '@hominem/auth/server';
import { db } from '@hominem/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { resetTestDb, seedFile, seedTestUser } from '../../../test/test-db';
import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { notesRoutes } from './notes';

const testUserId = '00000000-0000-4000-8000-000000000001';
const otherUserId = '00000000-0000-4000-8000-000000000002';
const testFileId = '11111111-1111-4111-8111-111111111111';
const nowIso = '2026-04-02T12:00:00.000Z';

function createUser(): User {
  return {
    id: testUserId,
    email: 'notes-test@hominem.test',
    isAdmin: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function createApp() {
  const app = new Hono<AppContext>().onError(apiErrorHandler);

  app.use('/api/notes/*', async (c, next) => {
    c.set('user', createUser());
    c.set('userId', testUserId);
    await next();
  });

  app.route('/api/notes', notesRoutes);

  return app;
}

async function postJson(app: Hono<AppContext>, path: string, body: Record<string, unknown>) {
  return app.request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function patchJson(app: Hono<AppContext>, path: string, body: Record<string, unknown>) {
  return app.request(`http://localhost${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
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
