import type { User } from '@hominem/auth/server';
import { db } from '@hominem/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  attachFileToNote,
  resetTestDb,
  seedChat,
  seedFile,
  seedNote,
  seedTestUser,
} from '../../../test/test-db';

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  getOpenAIAdapter: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@hominem/utils/logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

vi.mock('ai', () => ({
  generateText: mocks.generateText,
}));

vi.mock('../utils/llm', () => ({
  getOpenAIAdapter: mocks.getOpenAIAdapter,
}));

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { chatsRoutes } from './chats';

const testUserId = '00000000-0000-4000-8000-000000000001';
const testFileId = '11111111-1111-4111-8111-111111111111';
const testChatId = '33333333-3333-4333-8333-333333333333';
const nowIso = '2026-03-24T12:00:00.000Z';

function createUser(): User {
  return {
    id: testUserId,
    email: 'chat-upload-test@hominem.test',
    emailVerified: false,
    image: null,
    name: 'Chat Upload Test User',
    createdAt: new Date(nowIso),
    updatedAt: new Date(nowIso),
  };
}

function createApp() {
  const app = new Hono<AppContext>().onError(apiErrorHandler);

  app.use('/api/chats/*', async (c, next) => {
    c.set('user', createUser());
    c.set('userId', testUserId);
    await next();
  });

  app.route('/api/chats', chatsRoutes);

  return app;
}

async function postJson(
  app: Hono<AppContext>,
  path: string,
  body: Record<string, string | string[]>,
) {
  return app.request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('chatsRoutes send with attachments', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedTestUser({
      id: testUserId,
      email: 'chat-upload-test@hominem.test',
    });
    await seedChat({
      id: testChatId,
      ownerUserId: testUserId,
      title: 'Test chat',
    });

    vi.clearAllMocks();

    mocks.getOpenAIAdapter.mockReturnValue({ modelId: 'test-model' });
    mocks.generateText.mockResolvedValue({
      text: 'Assistant reply',
    });
  });

  afterEach(async () => {
    await resetTestDb();
  });

  test('accepts attachment-backed sends and persists user message files', async () => {
    await seedFile({
      id: testFileId,
      ownerUserId: testUserId,
      storageKey: `${testUserId}/${testFileId}-receipt.png`,
      originalName: 'receipt.png',
      mimetype: 'image/png',
      size: 128,
      url: 'https://cdn.example.com/uploads/receipt.png',
      textContent: 'Receipt for lunch',
    });

    const response = await postJson(createApp(), `/api/chats/${testChatId}/send`, {
      fileIds: [testFileId],
      message: '',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      messages: {
        user: {
          content: string;
          files: Array<{
            fileId?: string;
            filename?: string;
            metadata?: Record<string, unknown>;
          }> | null;
        };
      };
    };

    expect(body.messages.user.content).toBe('receipt.png');
    expect(body.messages.user.files).toMatchObject([
      {
        fileId: testFileId,
        filename: 'receipt.png',
        metadata: {
          extractedText: 'Receipt for lunch',
        },
      },
    ]);

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Attached files:'),
            role: 'user',
          }),
        ]),
      }),
    );

    const storedMessages = await db
      .selectFrom('app.chat_messages')
      .selectAll()
      .where('chat_id', '=', testChatId)
      .orderBy('createdat', 'asc')
      .execute();

    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[0]?.role).toBe('user');
    expect(storedMessages[1]?.role).toBe('assistant');
    expect(storedMessages[0]?.files).toMatchObject([
      {
        fileId: testFileId,
        filename: 'receipt.png',
      },
    ]);
  });

  test('returns validation error when an uploaded file cannot be resolved', async () => {
    const response = await postJson(createApp(), `/api/chats/${testChatId}/send`, {
      fileIds: [testFileId],
      message: '',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      error: 'validation_error',
      message: 'One or more uploaded files are unavailable',
    });
  });

  test('resolves referenced notes from mentions and persists note ids', async () => {
    const noteId = '22222222-2222-4222-8222-222222222222';

    await seedNote({
      id: noteId,
      ownerUserId: testUserId,
      title: 'Roadmap Draft',
      content: 'Ship notes and chat first.',
      excerpt: 'Ship notes and chat first.',
    });
    await seedFile({
      id: testFileId,
      ownerUserId: testUserId,
      storageKey: `${testUserId}/${testFileId}-roadmap.txt`,
      originalName: 'roadmap.txt',
      mimetype: 'text/plain',
      size: 64,
      url: 'https://cdn.example.com/uploads/roadmap.txt',
      textContent: 'Milestone details',
    });
    await attachFileToNote({
      noteId,
      fileId: testFileId,
    });

    const response = await postJson(createApp(), `/api/chats/${testChatId}/send`, {
      message: 'Summarize #roadmap-draft',
    });

    expect(response.status).toBe(200);
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Referenced notes:'),
          }),
        ]),
      }),
    );

    const storedMessage = await db
      .selectFrom('app.chat_messages')
      .selectAll()
      .where('chat_id', '=', testChatId)
      .where('role', '=', 'user')
      .executeTakeFirstOrThrow();

    expect(storedMessage.referenced_note_ids).toEqual([noteId]);
  });
});
