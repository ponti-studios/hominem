import { z } from 'zod';

import type { CreditKeys } from './credit';

const BASE = 'https://openrouter.ai/api/v1';

// OpenRouter's key management API: create a key (the key string is returned once),
// read its usage, disable it. Parsed defensively; anything unexpected is an error,
// never a guess.
const createdSchema = z.object({
  key: z.string().min(1),
  data: z.object({ hash: z.string().min(1) }),
});
const usageSchema = z.object({
  data: z.object({ usage_monthly: z.number().nonnegative() }),
});
const lifetimeUsageSchema = z.object({
  data: z.object({ usage: z.number().nonnegative() }),
});

export class OpenRouterKeysError extends Error {
  constructor(
    readonly what: string,
    readonly status: number,
  ) {
    super(`OpenRouter ${what} failed (${status})`);
    this.name = 'OpenRouterKeysError';
  }
}

export function createOpenRouterKeys(
  managementKey: string,
  fetchImpl: typeof fetch = fetch,
): CreditKeys {
  async function call(what: string, path: string, init: { method: string; body?: unknown }) {
    const response = await fetchImpl(`${BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${managementKey}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
    // The body is never logged or put in the error: a create response holds the key.
    if (!response.ok) throw new OpenRouterKeysError(what, response.status);
    const body: unknown = await response.json();
    return body;
  }

  return {
    async create({ name, limitUsd }) {
      const parsed = createdSchema.parse(
        await call('create key', '/keys', { method: 'POST', body: { name, limit: limitUsd } }),
      );
      return { key: parsed.key, hash: parsed.data.hash };
    },
    async disable(hash) {
      await call('disable key', `/keys/${encodeURIComponent(hash)}`, {
        method: 'PATCH',
        body: { disabled: true },
      });
    },
    async usage(hash) {
      const parsed = lifetimeUsageSchema.parse(
        await call('read key usage', `/keys/${encodeURIComponent(hash)}`, { method: 'GET' }),
      );
      return parsed.data.usage;
    },
    async setLimit(hash, limitUsd) {
      await call('set key limit', `/keys/${encodeURIComponent(hash)}`, {
        method: 'PATCH',
        body: { limit: limitUsd },
      });
    },
    async usageMonthly(hash) {
      const parsed = usageSchema.parse(
        await call('read key usage', `/keys/${encodeURIComponent(hash)}`, { method: 'GET' }),
      );
      return parsed.data.usage_monthly;
    },
  };
}
