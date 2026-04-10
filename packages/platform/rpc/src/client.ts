export interface HonoClientOptions {
  fetch?: typeof fetch;
}

export interface RpcRequestOptions {
  query?: Record<string, string | undefined>;
  json?: unknown;
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export interface RpcTransportClient {
  request(method: string, path: string, options?: RpcRequestOptions): Promise<Response>;
  get(path: string, options?: Omit<RpcRequestOptions, 'body'>): Promise<Response>;
  post(path: string, options?: RpcRequestOptions): Promise<Response>;
  patch(path: string, options?: RpcRequestOptions): Promise<Response>;
  delete(path: string, options?: Omit<RpcRequestOptions, 'body'>): Promise<Response>;
}

export type HonoClientType = RpcTransportClient;

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | undefined>): URL {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url;
}

function createRequest(
  fetchImpl: typeof fetch,
  baseUrl: string,
  method: string,
  path: string,
  options?: RpcRequestOptions,
): Promise<Response> {
  const headers = new Headers(options?.headers);
  const init: RequestInit = {
    method,
    headers,
  };

  if (options?.signal) {
    init.signal = options.signal;
  }

  if (options?.json !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    init.body = JSON.stringify(options.json);
  } else if (options?.body !== undefined) {
    init.body = options.body;
  }

  return fetchImpl(buildUrl(baseUrl, path, options?.query), init);
}

function buildClient(baseUrl: string, options?: HonoClientOptions): RpcTransportClient {
  const fetchImpl = options?.fetch ?? fetch;

  return {
    request(method, path, requestOptions) {
      return createRequest(fetchImpl, baseUrl, method, path, requestOptions);
    },
    get(path, requestOptions) {
      return createRequest(fetchImpl, baseUrl, 'GET', path, requestOptions);
    },
    post(path, requestOptions) {
      return createRequest(fetchImpl, baseUrl, 'POST', path, requestOptions);
    },
    patch(path, requestOptions) {
      return createRequest(fetchImpl, baseUrl, 'PATCH', path, requestOptions);
    },
    delete(path, requestOptions) {
      return createRequest(fetchImpl, baseUrl, 'DELETE', path, requestOptions);
    },
  };
}

export function createTransportClient(baseUrl: string, options?: HonoClientOptions): RpcTransportClient {
  return buildClient(baseUrl, options);
}

export function createClient(baseUrl: string, options?: HonoClientOptions): RpcTransportClient {
  return createTransportClient(baseUrl, options);
}

export const createHonoClient = createClient;
