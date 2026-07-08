import { hc } from 'hono/client';

export interface ClientConfig {
  baseUrl: string;
  getHeaders?: () => Promise<Record<string, string>>;
  onError?: (error: Error) => void;
}

/**
 * Structural fallback type for consumers that don't pass AppType.
 * Used by chat.types.ts, ai.types.ts, etc. for index-accessible routing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HonoClient = {
  [key: string]: HonoClient
} & {
  $get: (...args: any[]) => Promise<{ json(): Promise<any> }>
  $post: (...args: any[]) => Promise<{ json(): Promise<any> }>
  $put: (...args: any[]) => Promise<{ json(): Promise<any> }>
  $patch: (...args: any[]) => Promise<{ json(): Promise<any> }>
  $delete: (...args: any[]) => Promise<{ json(): Promise<any> }>
} & {
  api: HonoClient
}

const customFetch = (config: ClientConfig): typeof fetch =>
  async (input, init) => {
    const headers = new Headers(init?.headers);
    const extraHeaders = await config.getHeaders?.();

    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        headers.set(key, value);
      }
    }

    try {
      const response = await fetch(input as RequestInfo | URL, { ...init, headers, credentials: 'include' });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const message = errorText.length > 0 ? errorText : `Request failed with status ${response.status}`;
        const error = Object.assign(new Error(message), { status: response.status });
        throw error;
      }

      return response;
    } catch (error: unknown) {
      if (config.onError && error instanceof Error) {
        config.onError(error);
      }
      throw error;
    }
  }

export function createApiClient(config: ClientConfig): HonoClient {
  return hc(config.baseUrl, { fetch: customFetch(config) }) as any
}
