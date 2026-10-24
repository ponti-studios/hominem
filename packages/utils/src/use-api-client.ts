import { useCallback, useMemo, useRef, useState } from 'react';

export interface UseApiClientOptions {
  /** Base URL prepended to relative endpoints. Defaults to same-origin requests. */
  baseUrl?: string;
  /** Fetch credentials policy. Defaults to the browser's same-origin behavior. */
  credentials?: RequestCredentials;
  /** Injectable Fetch implementation for custom runtimes and deterministic tests. */
  fetcher?: typeof fetch;
}

export interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: T | null;
  headers?: HeadersInit;
  stream?: boolean;
  signal?: AbortSignal;
}

interface ApiState {
  isLoading: boolean;
  error: Error | null;
}

function trimSlashes(value: string, side: 'start' | 'end') {
  let start = 0;
  let end = value.length;
  if (side === 'start') while (start < end && value[start] === '/') start++;
  else while (end > start && value[end - 1] === '/') end--;
  return value.slice(start, end);
}

/** Longest server-supplied error text we surface, so a stack trace or HTML page can't flood the UI. */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/** Control characters and backslashes: URL parsers strip or rewrite these, which can turn `/\t/host` into `//host`. */
function hasUnsafeEndpointChars(endpoint: string) {
  for (let index = 0; index < endpoint.length; index++) {
    const code = endpoint.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

function hasDotSegment(endpoint: string) {
  const pathEnd = endpoint.search(/[?#]/);
  const path = pathEnd === -1 ? endpoint : endpoint.slice(0, pathEnd);
  for (const segment of path.split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return true;
    }
    if (decoded.split(/[/\\]/).some((part) => part === '.' || part === '..')) return true;
  }
  return false;
}

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Joins `endpoint` onto `baseUrl` without ever leaving the base's origin or path prefix.
 * Absolute endpoints are only accepted when they point at the same origin as an absolute
 * `baseUrl`, so cookies and auth headers can't be redirected to a third party.
 */
function resolveEndpoint(baseUrl: string, endpoint: string) {
  if (hasUnsafeEndpointChars(endpoint)) {
    throw new TypeError('Endpoint contains forbidden characters');
  }
  if (/^https?:\/\//i.test(endpoint)) {
    const target = new URL(endpoint);
    if (target.username || target.password) {
      throw new TypeError('Endpoint must not contain credentials');
    }
    const baseOrigin = originOf(baseUrl);
    if (baseOrigin === null || target.origin !== baseOrigin) {
      throw new TypeError('Absolute endpoint must be on the same origin as baseUrl');
    }
    return endpoint;
  }
  if (hasDotSegment(endpoint)) {
    throw new TypeError('Endpoint must not contain dot segments');
  }
  const base = trimSlashes(baseUrl, 'end');
  const path = trimSlashes(endpoint, 'start');
  return base ? `${base}/${path}` : `/${path}`;
}

async function responseErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  let message = '';
  if (contentType.includes('json')) {
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'message' in payload) {
      if (typeof payload.message === 'string') message = payload.message;
    }
  } else {
    message = await response.text().catch(() => '');
  }
  if (message.length === 0) return `Request failed with status ${response.status}`;
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

/**
 * Fetch hook for requests outside Hominem's typed RPC surface. Prefer the RPC
 * client for application APIs and keep server state in its query layer.
 */
export function useApiClient({
  baseUrl = '',
  credentials = 'same-origin',
  fetcher = fetch,
}: UseApiClientOptions = {}) {
  const [state, setState] = useState<ApiState>({ isLoading: false, error: null });
  const inFlightCount = useRef(0);

  const fetchApi = useCallback(
    async <T>(endpoint: string, options: ApiRequestOptions<T>): Promise<unknown> => {
      const { method = 'GET', body, headers, stream = false, signal } = options;
      inFlightCount.current += 1;
      setState((previous) => ({ ...previous, isLoading: true, error: null }));

      try {
        const requestHeaders = new Headers(headers);
        const hasBody = body !== undefined && body !== null;
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

        let requestBody: BodyInit | null = null;
        if (isFormData) {
          // The runtime must generate the multipart boundary; a caller-set type would break it.
          requestHeaders.delete('Content-Type');
          requestBody = body;
        } else if (hasBody) {
          const serializedBody = JSON.stringify(body);
          if (serializedBody === undefined) {
            throw new TypeError('Request body cannot be serialized to JSON');
          }
          requestBody = serializedBody;
          if (!requestHeaders.has('Content-Type')) {
            requestHeaders.set('Content-Type', 'application/json');
          }
        }
        const response = await fetcher(resolveEndpoint(baseUrl, endpoint), {
          method,
          headers: requestHeaders,
          body: requestBody,
          credentials,
          signal,
        });

        if (!response.ok) throw new Error(await responseErrorMessage(response));
        if (stream) return response;
        if (response.status === 204 || response.status === 205) return undefined;

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('json')) {
          const payload: unknown = await response.json();
          return payload;
        }
        if (response.status === 0 || response.headers.get('content-length') === '0') {
          return undefined;
        }
        const text = await response.text();
        return text.length === 0 ? undefined : text;
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error('An unknown request error occurred');
        setState((previous) => ({ ...previous, error: normalizedError }));
        throw normalizedError;
      } finally {
        inFlightCount.current = Math.max(0, inFlightCount.current - 1);
        const isLoading = inFlightCount.current > 0;
        setState((previous) => ({ ...previous, isLoading }));
      }
    },
    [baseUrl, credentials, fetcher],
  );

  const api = useMemo(
    () => ({
      get: (endpoint: string, options?: Omit<ApiRequestOptions<never>, 'method' | 'body'>) =>
        fetchApi<never>(endpoint, { ...options, method: 'GET' }),

      post: <T>(endpoint: string, data?: T, options?: Omit<ApiRequestOptions<T>, 'method'>) =>
        fetchApi<T>(endpoint, { ...options, method: 'POST', body: data }),

      postStream: <T>(
        endpoint: string,
        data: T,
        options?: Omit<ApiRequestOptions<T>, 'method' | 'stream'>,
      ) =>
        fetchApi<T>(endpoint, { ...options, method: 'POST', body: data, stream: true }).then(
          (result) => {
            if (result instanceof Response) return result;
            throw new Error('Expected a streaming response');
          },
        ),

      postFormData: (
        endpoint: string,
        formData: FormData,
        options?: Omit<ApiRequestOptions<FormData>, 'method'>,
      ) => fetchApi<FormData>(endpoint, { ...options, method: 'POST', body: formData }),

      put: <T>(endpoint: string, data: T, options?: Omit<ApiRequestOptions<T>, 'method'>) =>
        fetchApi<T>(endpoint, { ...options, method: 'PUT', body: data }),

      delete: (endpoint: string, options?: Omit<ApiRequestOptions<never>, 'method'>) =>
        fetchApi<never>(endpoint, { ...options, method: 'DELETE' }),
    }),
    [fetchApi],
  );

  return { ...api, isLoading: state.isLoading, error: state.error };
}
