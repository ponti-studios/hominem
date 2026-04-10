import type { User } from '@hominem/auth/server';
import { db } from '@hominem/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { resetTestDb, seedTestUser } from '../../../test/test-db';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  processFile: vi.fn(),
  storeFile: vi.fn(),
}));

vi.mock('@hominem/utils/storage', () => ({
  fileStorageService: {
    storeFile: mocks.storeFile,
  },
}));

vi.mock('@hominem/services/files', () => ({
  FileProcessorService: {
    processFile: mocks.processFile,
  },
}));

vi.mock('@hominem/utils/logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { filesRoutes } from './files';

const testUserId = '00000000-0000-4000-8000-000000000001';
const testFileId = '11111111-1111-4111-8111-111111111111';
const nowIso = '2025-03-01T12:00:00.000Z';

function createUser(): User {
  return {
    id: testUserId,
    email: 'upload-test@hominem.test',
    emailVerified: false,
    image: null,
    name: 'Upload Test User',
    createdAt: new Date(nowIso),
    updatedAt: new Date(nowIso),
  };
}

function createApp(options: { authenticated?: boolean } = {}) {
  const app = new Hono<AppContext>().onError(apiErrorHandler);

  if (options.authenticated !== false) {
    app.use('/api/files/*', async (c, next) => {
      c.set('user', createUser());
      c.set('userId', testUserId);
      await next();
    });
  }

  app.route('/api/files', filesRoutes);

  return app;
}

async function postForm(app: Hono<AppContext>, path: string, formData: FormData) {
  return app.request(`http://localhost${path}`, {
    method: 'POST',
    body: formData,
  });
}

function createUploadForm(
  fileName = 'report.pdf',
  type = 'application/pdf',
  contents = 'file-body',
) {
  const formData = new FormData();
  formData.append('file', new File([contents], fileName, { type }));
  formData.append('originalName', fileName);
  formData.append('mimetype', type);
  return formData;
}

describe('filesRoutes canonical upload lifecycle', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedTestUser({
      id: testUserId,
      email: 'upload-test@hominem.test',
    });

    vi.clearAllMocks();

    mocks.storeFile.mockResolvedValue({
      id: testFileId,
      originalName: 'report.pdf',
      mimetype: 'application/pdf',
      size: 512,
      url: 'https://cdn.example.com/report.pdf',
      uploadedAt: new Date(nowIso),
      filename: `users/${testUserId}/chats/${testFileId}-report.pdf`,
    });
    mocks.processFile.mockResolvedValue({
      id: testFileId,
      originalName: 'report.pdf',
      type: 'document',
      mimetype: 'application/pdf',
      size: 9,
      textContent: 'Extracted text',
      metadata: {
        pages: 1,
      },
    });
  });

  afterEach(async () => {
    await resetTestDb();
  });

  test('rejects upload when unauthenticated', async () => {
    const response = await postForm(
      createApp({ authenticated: false }),
      '/api/files',
      createUploadForm(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
      error: 'unauthorized',
      message: 'Authentication required',
    });
  });

  test('rejects upload when file is missing', async () => {
    const formData = new FormData();
    formData.append('originalName', 'report.pdf');
    formData.append('mimetype', 'application/pdf');

    const response = await postForm(createApp(), '/api/files', formData);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      error: 'validation_error',
      message: 'File is required',
    });
    expect(mocks.storeFile).not.toHaveBeenCalled();
  });

  test('rejects upload when file is empty', async () => {
    const response = await postForm(
      createApp(),
      '/api/files',
      createUploadForm('empty.txt', 'text/plain', ''),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_ERROR',
      error: 'validation_error',
      message: 'Uploaded file cannot be empty',
    });
    expect(mocks.storeFile).not.toHaveBeenCalled();
    expect(mocks.processFile).not.toHaveBeenCalled();
  });

  test('returns the canonical uploaded file payload after upload', async () => {
    const response = await postForm(createApp(), '/api/files', createUploadForm());

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      file: {
        id: string;
        originalName: string;
        type: string;
        mimetype: string;
        size: number;
        textContent?: string;
        url: string;
        uploadedAt: string;
        vectorIds: string[];
      };
      message: string;
    };

    expect(body.success).toBe(true);
    expect(body.message).toBe('File uploaded successfully');
    expect(body.file).toMatchObject({
      id: testFileId,
      originalName: 'report.pdf',
      type: 'document',
      mimetype: 'application/pdf',
      size: 9,
      textContent: 'Extracted text',
      url: 'https://cdn.example.com/report.pdf',
      vectorIds: [],
    });
    expect(Number.isNaN(Date.parse(body.file.uploadedAt))).toBe(false);
    expect(mocks.storeFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'application/pdf',
      testUserId,
      { originalName: 'report.pdf' },
    );
    expect(mocks.processFile).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'report.pdf',
      'application/pdf',
      testFileId,
    );

    const stored = await db
      .selectFrom('app.files')
      .selectAll()
      .where('id', '=', testFileId)
      .where('owner_userid', '=', testUserId)
      .executeTakeFirstOrThrow();

    expect(stored.original_name).toBe('report.pdf');
    expect(stored.size).toBe(9);
    expect(stored.text_content).toBe('Extracted text');
    expect(stored.metadata).toEqual({ pages: 1 });
  });
});
