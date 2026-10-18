import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RpcUser } from '../middleware/auth';

const mocks = vi.hoisted(() => {
  const managementKey: { value: string | undefined } = { value: 'mgmt-key' };
  return {
    BudgetUnavailableError: class BudgetUnavailableError extends Error {},
    OpenRouterKeysError: class OpenRouterKeysError extends Error {},
    mintCredential: vi.fn(),
    revokeCredential: vi.fn(),
    budgetFor: vi.fn(),
    isBlocked: vi.fn(),
    isAllowed: vi.fn(),
    managementKey,
    inCreditMode: { value: false },
    creditFor: vi.fn(),
    sendLowCreditEmail: vi.fn(),
  };
});

vi.mock('../../application/provider-credentials', () => ({
  mintCredential: mocks.mintCredential,
  revokeCredential: mocks.revokeCredential,
  budgetFor: mocks.budgetFor,
  BudgetUnavailableError: mocks.BudgetUnavailableError,
}));
vi.mock('../../application/provider-credentials.store', () => ({
  dbCredentialStore: { isBlocked: mocks.isBlocked, isAllowed: mocks.isAllowed },
}));
vi.mock('../../application/openrouter-keys', () => ({
  createOpenRouterKeys: () => ({}),
  OpenRouterKeysError: mocks.OpenRouterKeysError,
}));
vi.mock('../../application/credit.runtime', () => ({
  personInCreditMode: async () => mocks.inCreditMode.value,
  devBase: () => undefined,
  creditDeps: () => ({ store: 'credit-store' }),
}));
vi.mock('../../application/credit', () => ({ creditFor: mocks.creditFor }));
vi.mock('../../application/credit-email', () => ({
  sendLowCreditEmail: mocks.sendLowCreditEmail,
}));
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
  mocks.inCreditMode.value = false;
  mocks.isBlocked.mockResolvedValue(false);
  mocks.isAllowed.mockResolvedValue(true);
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
  ])('maps %s to %i with an error code', async (kind, status) => {
    mocks.mintCredential.mockResolvedValue({ kind });
    const response = await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: kind });
  });

  it('is unavailable, not an error, when the management key is not set', async () => {
    mocks.managementKey.value = undefined;
    const response = await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(response.status).toBe(503);
    expect(mocks.mintCredential).not.toHaveBeenCalled();
  });

  it('gives the balance rules only to a person in credit mode', async () => {
    mocks.mintCredential.mockResolvedValue({ kind: 'minted', key: 'k', hash: 'h', limitUsd: 1.25 });
    await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(mocks.mintCredential.mock.calls[0]?.[0]).not.toHaveProperty('credit');
    mocks.inCreditMode.value = true;
    await postJson(app, '/api/credentials', { deviceId: DEVICE });
    expect(mocks.mintCredential.mock.calls[1]?.[0]).toHaveProperty('credit');
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

describe('GET /api/credentials/budget', () => {
  const budget = {
    capUsd: 5,
    spentUsd: 1.2,
    remainingUsd: 3.8,
    resetsAt: '2026-11-01T00:00:00.000Z',
    asOf: '2026-10-17T10:00:00.000Z',
  };

  it('returns the person’s budget, never cached', async () => {
    mocks.budgetFor.mockResolvedValue(budget);
    const response = await app.request('/api/credentials/budget');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(budget);
    expect(mocks.budgetFor).toHaveBeenCalledWith(expect.anything(), user.id);
  });

  it('gives a person in credit mode their balance instead of the monthly numbers', async () => {
    mocks.inCreditMode.value = true;
    const credit = {
      balancePence: 819,
      lastAddedPence: 819,
      usdPerPound: 1.28,
      asOf: '2026-10-18T10:00:00.000Z',
    };
    mocks.creditFor.mockResolvedValue(credit);
    const response = await app.request('/api/credentials/budget');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ credit });
    expect(mocks.budgetFor).not.toHaveBeenCalled();
    expect(mocks.creditFor).toHaveBeenCalledWith(expect.anything(), user.id, expect.anything());
  });

  it('keeps everyone else on the monthly budget', async () => {
    mocks.budgetFor.mockResolvedValue(budget);
    await app.request('/api/credentials/budget');
    expect(mocks.creditFor).not.toHaveBeenCalled();
  });

  it.each([
    ['blocked', 'isBlocked', true],
    ['not_listed', 'isAllowed', false],
  ] as const)('refuses a person who is %s, as minting does', async (code, check, value) => {
    mocks[check].mockResolvedValue(value);
    const response = await app.request('/api/credentials/budget');
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: code });
    expect(mocks.budgetFor).not.toHaveBeenCalled();
  });

  it('is unavailable when the management key is not set or OpenRouter fails', async () => {
    mocks.managementKey.value = undefined;
    expect((await app.request('/api/credentials/budget')).status).toBe(503);
    mocks.managementKey.value = 'mgmt-key';
    mocks.budgetFor.mockRejectedValue(new mocks.OpenRouterKeysError('usage failed'));
    expect((await app.request('/api/credentials/budget')).status).toBe(503);
    mocks.budgetFor.mockRejectedValue(new mocks.BudgetUnavailableError('too slow'));
    expect((await app.request('/api/credentials/budget')).status).toBe(503);
  });

  it('lets an unexpected failure reach the global handler instead of calling it an outage', async () => {
    mocks.budgetFor.mockRejectedValue(new Error('rows is not iterable'));
    const response = await app.request('/api/credentials/budget');
    expect(response.status).toBe(500);
  });

  it('requires a signed-in person', async () => {
    const anonymous = createRpcTestApp(credentialsRoutes, {
      path: '/api/credentials',
      user,
      authenticated: false,
    });
    expect((await anonymous.request('/api/credentials/budget')).status).toBe(401);
  });
});
