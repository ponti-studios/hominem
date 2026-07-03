import { hc } from 'hono/client';

export interface RpcResponse {
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

type RpcMethod = (args?: unknown) => Promise<RpcResponse>;

export type RpcBranch = {
  [key: string]: RpcBranch;
} & {
  $delete: RpcMethod;
  $get: RpcMethod;
  $patch: RpcMethod;
  $post: RpcMethod;
  $put: RpcMethod;
};

export interface ClientConfig {
  baseUrl: string;
  getHeaders?: () => Promise<Record<string, string>>;
  onError?: (error: Error) => void;
}

export type HonoClient = RpcBranch & { api: RpcBranch };

export function createApiClient(config: ClientConfig): HonoClient {
  const client = hc(config.baseUrl, {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const extraHeaders = await config.getHeaders?.();

      if (extraHeaders) {
        for (const [key, value] of Object.entries(extraHeaders)) {
          headers.set(key, value);
        }
      }

      try {
        const response = await fetch(input, { ...init, headers, credentials: 'include' });

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
    },
  });

  return client as unknown as HonoClient;
}
