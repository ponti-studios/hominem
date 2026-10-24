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

function resolveEndpoint(baseUrl: string, endpoint: string) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = trimSlashes(baseUrl, 'end');
  const path = trimSlashes(endpoint, 'start');
  return base ? `${base}/${path}` : `/${path}`;
}

async function responseErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string' && message.length > 0) return message;
    }
  } else {
    const text = await response.text().catch(() => '');
    if (text.length > 0) return text;
  }
  return `Request failed with status ${response.status}`;
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
    async <T>(endpoint: string, options: ApiRequestOptions<T> = {}): Promise<unknown> => {
      const { method = 'GET', body, headers, stream = false, signal } = options;
      inFlightCount.current += 1;
      setState((previous) => ({ ...previous, isLoading: true, error: null }));

      try {
        const requestHeaders = new Headers(headers);
        const hasBody = body !== undefined && body !== null;
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

        if (hasBody && !isFormData && !requestHeaders.has('Content-Type')) {
          requestHeaders.set('Content-Type', 'application/json');
        }

        let requestBody: BodyInit | null = null;
        if (body !== undefined && body !== null) {
          if (typeof FormData !== 'undefined' && body instanceof FormData) requestBody = body;
          else {
            const serializedBody = JSON.stringify(body);
            if (serializedBody === undefined) {
              throw new TypeError('Request body cannot be serialized to JSON');
            }
            requestBody = serializedBody;
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
