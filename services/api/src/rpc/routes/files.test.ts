import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext, RpcUser } from '../middleware/auth';
import { requestIdMiddleware } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';

const mocks = vi.hoisted(() => ({
  createPending: vi.fn(),
  getPending: vi.fn(),
  markReady: vi.fn(),
  deletePending: vi.fn(),
  getOwned: vi.fn(),
  createUploadIntent: vi.fn(),
  finalizeUpload: vi.fn(),
  getPublicUrl: vi.fn((key: string) => `https://files.test/${key}`),
  signStoredUrl: vi.fn(async (url: string) => `${url}?sig=1`),
  enqueue: vi.fn(),
}));

vi.mock('@hominem/db/core', () => ({ db: {} }));
vi.mock('@hominem/db/files', () => ({
  FileRepository: {
    createPending: mocks.createPending,
    getPending: mocks.getPending,
    markReady: mocks.markReady,
    deletePending: mocks.deletePending,
    getOwned: mocks.getOwned,
  },
}));
vi.mock('@hominem/queues', () => ({ fileProcessingQueue: { add: mocks.enqueue } }));
vi.mock('@hominem/storage', () => ({
  fileStorageService: {
    createUploadIntent: mocks.createUploadIntent,
    finalizeUpload: mocks.finalizeUpload,
    getPublicUrl: mocks.getPublicUrl,
    signStoredUrl: mocks.signStoredUrl,
  },
  isStorageServiceError: () => false,
  sniffContent: vi.fn(),
}));
vi.mock('@hominem/telemetry', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  recordTelemetryException: vi.fn(),
}));
vi.mock('../middleware/rate-limit', () => ({
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { filesRoutes } from './files';

const testUser: RpcUser = {
  id: 'user-1',
  email: 'u@test.hominem.dev',
  name: 'U',
  image: null,
  emailVerified: true,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware);
  app.use('*', async (c, next) => {
    c.set('auth', { user: testUser, userId: testUser.id, credential: 'session', scopes: [] });
    await next();
  });
  return app.route('/api/files', filesRoutes);
}

const fileRecord = {
  id: 'f1',
  originalName: 'a.png',
  type: 'image',
  mimetype: 'image/png',
  size: 16,
  url: 'https://files.test/users/user-1/chats/f1',
  uploadedAt: '2026-01-01T00:00:00.000Z',
};

const post = (path: string, body?: unknown) =>
  createApp().request(`/api/files${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('direct file uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signStoredUrl.mockImplementation(async (url: string) => `${url}?sig=1`);
  });

  it('reserves a pending row and returns a presigned PUT', async () => {
    mocks.createUploadIntent.mockResolvedValue({
      id: 'f1',
      quarantineKey: 'quarantine/users/user-1/f1',
      uploadUrl: 'https://r2.test/put',
      headers: { 'content-type': 'image/png' },
      expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    });

    const res = await post('/uploads', { originalName: 'a.png', mimetype: 'image/png', size: 16 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: 'f1',
      method: 'PUT',
      uploadUrl: 'https://r2.test/put',
      headers: { 'content-type': 'image/png' },
    });
    expect(mocks.createPending).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: 'f1',
        userId: 'user-1',
        storageKey: 'quarantine/users/user-1/f1',
      }),
    );
  });

  it('rejects unsupported types and oversized files before touching storage', async () => {
    const svg = await post('/uploads', {
      originalName: 'a.svg',
      mimetype: 'image/svg+xml',
      size: 10,
    });
    expect(svg.status).toBe(400);
    const big = await post('/uploads', {
      originalName: 'a.png',
      mimetype: 'image/png',
      size: 50 * 1024 * 1024,
    });
    expect(big.status).toBe(400);
    expect(mocks.createUploadIntent).not.toHaveBeenCalled();
    expect(mocks.createPending).not.toHaveBeenCalled();
  });

  it('promotes a verified upload, marks it ready, and queues processing', async () => {
    mocks.getPending.mockResolvedValue({
      id: 'f1',
      userId: 'user-1',
      storageKey: 'quarantine/users/user-1/f1',
      originalName: 'a.png',
      mimetype: 'image/png',
      size: 16,
    });
    mocks.finalizeUpload.mockResolvedValue({ ok: true, key: 'users/user-1/chats/f1', size: 16 });
    mocks.markReady.mockResolvedValue(fileRecord);

    const res = await post('/uploads/f1/complete');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.file.url).toBe(`${fileRecord.url}?sig=1`);
    expect(mocks.markReady).toHaveBeenCalledWith({}, 'f1', 'user-1', {
      storageKey: 'users/user-1/chats/f1',
      url: 'https://files.test/users/user-1/chats/f1',
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('drops the pending row when verification fails', async () => {
    mocks.getPending.mockResolvedValue({
      id: 'f1',
      userId: 'user-1',
      storageKey: 'quarantine/users/user-1/f1',
      originalName: 'a.png',
      mimetype: 'image/png',
      size: 16,
    });
    mocks.finalizeUpload.mockResolvedValue({ ok: false, reason: 'content_rejected' });

    const res = await post('/uploads/f1/complete');
    expect(res.status).toBe(400);
    expect(mocks.deletePending).toHaveBeenCalledWith({}, 'f1', 'user-1');
    expect(mocks.markReady).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('404s completing an upload that is not yours or not pending', async () => {
    mocks.getPending.mockResolvedValue(null);
    const res = await post('/uploads/nope/complete');
    expect(res.status).toBe(404);
    expect(mocks.finalizeUpload).not.toHaveBeenCalled();
  });

  it('hands back a fresh signed url for an owned file and 404s otherwise', async () => {
    mocks.getOwned.mockResolvedValueOnce(fileRecord);
    const ok = await createApp().request('/api/files/f1/url');
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ url: `${fileRecord.url}?sig=1` });

    mocks.getOwned.mockResolvedValueOnce(null);
    const missing = await createApp().request('/api/files/f2/url');
    expect(missing.status).toBe(404);
  });
});
