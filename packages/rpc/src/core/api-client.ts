import type { AppType } from '@hominem/api/types';
import { hc } from 'hono/client';

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export interface ClientConfig {
  baseUrl: string;
  request?: Request;
  getHeaders?: () => HeadersInit | Promise<HeadersInit>;
  onError?: (error: Error) => void;
  throwOnError?: boolean;
  /** Overall request timeout. Defaults to 10s; override per call with `init.timeoutMs`. */
  timeoutMs?: number;
}

export type ApiFetchInit = RequestInit & { timeoutMs?: number };
export type ApiFetch = (input: RequestInfo | URL, init?: ApiFetchInit) => Promise<Response>;
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function createRequestSignal(existing: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;

  const onAbort = () => controller.abort(existing?.reason);
  if (existing?.aborted) {
    controller.abort(existing.reason);
  } else {
    existing?.addEventListener('abort', onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      existing?.removeEventListener('abort', onAbort);
    },
  };
}

export function createCustomFetch(
  config: ClientConfig,
  fetchImpl: FetchImplementation = fetch,
  dispatcher?: unknown,
): ApiFetch {
  const defaultTimeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const cookie = config.request?.headers.get('cookie');
    const extraHeaders = await config.getHeaders?.();

    if (cookie) headers.set('cookie', cookie);
    if (extraHeaders) {
      for (const [key, value] of new Headers(extraHeaders)) headers.set(key, value);
    }

    const timeoutMs = init?.timeoutMs ?? defaultTimeoutMs;
    const requestSignal = createRequestSignal(init?.signal, timeoutMs);
    const requestInit = {
      ...init,
      headers,
      credentials: 'include',
      signal: requestSignal.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit;

    try {
      const response = await fetchImpl(input, requestInit);

      if (config.throwOnError !== false && !response.ok) {
        const errorText = await response.text().catch(() => '');
        const message =
          errorText.length > 0 ? errorText : `Request failed with status ${response.status}`;
        const error = Object.assign(new Error(message), { status: response.status });
        throw error;
      }

      return response;
    } catch (error: unknown) {
      if (requestSignal.didTimeOut()) {
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
        config.onError?.(timeoutError);
        throw timeoutError;
      }
      if (config.onError && error instanceof Error) {
        config.onError(error);
      }
      throw error;
    } finally {
      requestSignal.cleanup();
    }
  };
}

export const customFetch = (config: ClientConfig): ApiFetch => createCustomFetch(config);

export type HonoClient = ReturnType<typeof hc<AppType>>;

export function createApiClient(config: ClientConfig): HonoClient {
  return hc<AppType>(config.baseUrl, { fetch: customFetch(config) });
}
