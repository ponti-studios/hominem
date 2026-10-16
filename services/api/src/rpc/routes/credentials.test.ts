import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RpcUser } from '../middleware/auth';

const mocks = vi.hoisted(() => ({
  mintCredential: vi.fn(),
  revokeCredential: vi.fn(),
  managementKey: { value: 'mgmt-key' as string | undefined },
}));

vi.mock('../../application/provider-credentials', () => ({
  mintCredential: mocks.mintCredential,
  revokeCredential: mocks.revokeCredential,
}));
vi.mock('../../application/provider-credentials.store', () => ({ dbCredentialStore: {} }));
vi.mock('../../application/openrouter-keys', () => ({ createOpenRouterKeys: () => ({}) }));
vi.mock('../../env', () => ({
  env: {
    get OPENROUTER_MANAGEMENT_KEY() {
      return mocks.managementKey.value;
    },
    THAMES_MONTHLY_CAP_USD: 5,
  },
}));

import { createRpcTestApp, postJson } from '../../testkit/rpc-test-app';
import { credentialsRoutes } from './credentials';

const user: RpcUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'dana@work.com',
  name: 'Dana',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const app = createRpcTestApp(credentialsRoutes, { path: '/api/credentials', user });
const DEVICE = 'device-12345678';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.managementKey.value = 'mgmt-key';
});

describe('POST /api/credentials', () => {
  it('returns the key once, not stored, with no-store caching', async () => {
    mocks.mintCredential.mockResolvedValue({
      kind: 'minted',
      key: 'sk-or-secret',
      hash: 'h',
      limitUsd: 1.6666,
    });
    const response = await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ key: 'sk-or-secret', limitUsd: 1.6666 });
    expect(mocks.mintCredential).toHaveBeenCalledWith(expect.anything(), {
      userId: user.id,
      email: user.email,
      deviceId: DEVICE,
    });
  });

  it.each([
    ['capped', 402],
    ['rate_limited', 429],
    ['not_listed', 403],
    ['blocked', 403],
  ])('maps %s to %i with a code', async (kind, status) => {
    mocks.mintCredential.mockResolvedValue({ kind });
    const response = await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ code: kind });
  });

  it('is unavailable, not an error, when the management key is not set', async () => {
    mocks.managementKey.value = undefined;
    const response = await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(response.status).toBe(503);
    expect(mocks.mintCredential).not.toHaveBeenCalled();
  });

  it('rejects a missing or short device id', async () => {
    expect((await postJson(app, '/api/credentials', {})).status).toBe(400);
    expect((await postJson(app, '/api/credentials', { deviceId: 'short' })).status).toBe(400);
  });

  it('requires a signed-in person', async () => {
    const anonymous = createRpcTestApp(credentialsRoutes, {
      path: '/api/credentials',
      user,
      authenticated: false,
    });
    expect((await postJson(anonymous, '/api/credentials', { deviceId: DEVICE })).status).toBe(401);
  });
});

describe('DELETE /api/credentials/:deviceId', () => {
  it('ends the key for the signed-in person and device', async () => {
    mocks.revokeCredential.mockResolvedValue(true);
    const response = await app.request(`/api/credentials/${DEVICE}`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(mocks.revokeCredential).toHaveBeenCalledWith(expect.anything(), {
      userId: user.id,
      deviceId: DEVICE,
    });
  });

  it('is 404 for a device the person does not have', async () => {
    mocks.revokeCredential.mockResolvedValue(false);
    const response = await app.request(`/api/credentials/${DEVICE}`, { method: 'DELETE' });
    expect(response.status).toBe(404);
  });
});
