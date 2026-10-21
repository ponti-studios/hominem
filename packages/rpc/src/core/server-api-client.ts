import type { AppType } from '@hominem/api/types';
import { hc } from 'hono/client';
import { Agent } from 'undici';

import { createCustomFetch, type ApiFetch, type ClientConfig, type HonoClient } from './api-client';

const CONNECT_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 10_000;
const KEEP_ALIVE_TIMEOUT_MS = 30_000;

// One dispatcher shared by every server-side internal RPC call, so web/career
// reuse connections instead of paying a fresh TCP/TLS setup per request.
export const internalDispatcher = new Agent({
  connect: { timeout: CONNECT_TIMEOUT_MS },
  keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
  keepAliveMaxTimeout: KEEP_ALIVE_TIMEOUT_MS * 2,
});

// Node's global fetch is undici, so the agent plugs in through the standard
// `dispatcher` init option. Resolving `fetch` per call (rather than importing
// undici's fetch) keeps test interceptors like MSW in the loop.
export const customFetch = (config: ClientConfig): ApiFetch =>
  createCustomFetch({ timeoutMs: REQUEST_TIMEOUT_MS, ...config }, fetch, internalDispatcher);

export function createApiClient(config: ClientConfig): HonoClient {
  return hc<AppType>(config.baseUrl, { fetch: customFetch(config) });
}
