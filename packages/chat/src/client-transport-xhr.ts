import type {
  ChatClientStreamRequest,
  ChatClientStreamResult,
  ChatClientTransport,
  ChatClientTransportRequest,
} from './client-transport-fetch';

export type Xhr = {
  open: (method: string, url: string) => void;
  setRequestHeader: (name: string, value: string) => void;
  send: (body: unknown) => void;
  abort: () => void;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  onreadystatechange: (() => void) | null;
  readyState: number;
  responseText: string;
  status: number;
};

export type XhrFactory = () => Xhr;

// This transport only ever runs on React Native, which always provides a
// global XMLHttpRequest — no feature-detection needed, just the ambient type
// this package's `lib: ["ESNext"]` (no DOM lib) doesn't otherwise have.
declare const XMLHttpRequest: new () => Xhr;

const defaultXhrFactory: XhrFactory = () => new XMLHttpRequest();

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function applyHeaders(xhr: Xhr, headers: RequestInit['headers']) {
  new Headers(headers).forEach((value, key) => xhr.setRequestHeader(key, value));
}

export const xhrChatTransport = (
  createXhr: XhrFactory = defaultXhrFactory,
): ChatClientTransport => ({
  request: ({ url, init, signal }: ChatClientTransportRequest) =>
    new Promise<Response>((resolve, reject) => {
      const xhr = createXhr();
      xhr.open(init.method ?? 'GET', url);
      applyHeaders(xhr, init.headers);
      xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
      xhr.onerror = () => reject(new Error('Network request failed'));
      xhr.onabort = () => reject(abortError());
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      void xhr.send(init.body ?? null);
    }),
  // Unlike `request`, which can only resolve once the XHR is fully loaded,
  // this delivers `xhr.responseText` progressively via `onreadystatechange`
  // (readyState 3 = "loading", i.e. bytes are arriving) so callers see SSE
  // events as they stream in rather than only after the connection closes.
  stream: ({ url, init, signal, onChunk }: ChatClientStreamRequest) =>
    new Promise<ChatClientStreamResult>((resolve, reject) => {
      const xhr = createXhr();
      let offset = 0;
      let settled = false;
      xhr.open(init.method ?? 'GET', url);
      applyHeaders(xhr, init.headers);
      const readAvailable = () => {
        const chunk = xhr.responseText.slice(offset);
        offset = xhr.responseText.length;
        if (chunk) onChunk(chunk);
      };
      xhr.onreadystatechange = () => {
        if (settled || xhr.readyState < 3) return;
        readAvailable();
        if (xhr.readyState !== 4 || settled) return;
        settled = true;
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status });
      };
      xhr.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error('Network request failed'));
      };
      xhr.onabort = () => {
        if (settled) return;
        settled = true;
        reject(abortError());
      };
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      void xhr.send(init.body ?? null);
    }),
});
