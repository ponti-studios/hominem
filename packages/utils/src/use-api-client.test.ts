// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApiClient, type UseApiClientOptions } from './use-api-client';

const JSON_HEADERS = { 'content-type': 'application/json' };

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function textResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: { 'content-type': 'text/plain', ...init.headers },
  });
}

/** A body with no content-type header at all (strings and JSON set one automatically). */
function untypedResponse(body: string, init: ResponseInit = {}) {
  return new Response(new TextEncoder().encode(body), init);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function messageOf(error: unknown) {
  if (!(error instanceof Error)) throw new Error('expected an Error');
  return error.message;
}

function nameOf(error: unknown) {
  if (!(error instanceof Error)) throw new Error('expected an Error');
  return error.name;
}

let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;

function setup(options: UseApiClientOptions = {}) {
  return renderHook((props: UseApiClientOptions) => useApiClient(props), {
    initialProps: { fetcher, ...options },
  });
}

function lastCall() {
  const call = fetcher.mock.calls.at(-1);
  if (!call) throw new Error('fetcher was not called');
  const [url, init] = call;
  if (!init) throw new Error('fetcher was called without init');
  const headers = init.headers;
  if (!(headers instanceof Headers)) throw new Error('expected Headers');
  return { url, init, headers };
}

/** Runs a request inside act and returns what it settled to, never throwing. */
async function settle(request: Promise<unknown>) {
  let outcome: { ok: true; value: unknown } | { ok: false; error: unknown } | undefined;
  await act(async () => {
    outcome = await request.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
  });
  if (!outcome) throw new Error('request did not settle');
  return outcome;
}

async function rejection(request: Promise<unknown>) {
  const outcome = await settle(request);
  if (outcome.ok) throw new Error('expected the request to reject');
  return outcome.error;
}

beforeEach(() => {
  fetcher = vi.fn<typeof fetch>(async () => jsonResponse({ ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useApiClient: endpoint resolution', () => {
  it.each([
    ['', '/users', '/users'],
    ['', 'users', '/users'],
    ['', '', '/'],
    ['/api', '/users', '/api/users'],
    ['/api/', 'users', '/api/users'],
    ['https://api.example.com/v1///', '///users', 'https://api.example.com/v1/users'],
    [
      'https://api.example.com',
      '/users?limit=1&q=a/b',
      'https://api.example.com/users?limit=1&q=a/b',
    ],
    ['', '/users#top', '/users#top'],
    ['', '/files/.well-known/a..b/.hidden', '/files/.well-known/a..b/.hidden'],
    ['', '/search?next=../up#../frag', '/search?next=../up#../frag'],
    ['', '/caf%C3%A9', '/caf%C3%A9'],
  ])('joins base %j with endpoint %j as %j', async (baseUrl, endpoint, expected) => {
    const { result } = setup({ baseUrl });
    await settle(result.current.get(endpoint));
    expect(lastCall().url).toBe(expected);
  });

  it('keeps protocol-relative endpoints on the current origin', async () => {
    const { result } = setup();
    await settle(result.current.get('//evil.example/steal'));
    expect(lastCall().url).toBe('/evil.example/steal');
    await settle(result.current.get('////evil.example'));
    expect(lastCall().url).toBe('/evil.example');
  });

  it('does not treat javascript:, data: or other schemes as absolute URLs', async () => {
    const { result } = setup();
    await settle(result.current.get('javascript:alert(1)'));
    expect(lastCall().url).toBe('/javascript:alert(1)');
    await settle(result.current.get('data:text/html,hi'));
    expect(lastCall().url).toBe('/data:text/html,hi');
    await settle(result.current.get('ftp://files.example/x'));
    expect(lastCall().url).toBe('/ftp://files.example/x');
  });

  it.each([
    ['tab', '\t/evil.example'],
    ['newline', '\n//evil.example'],
    ['carriage return', '/\r/evil.example'],
    ['null byte', '/a\u0000b'],
    ['unit separator', '/a\u001fb'],
    ['DEL', '/a\u007fb'],
    ['backslash', '/\\evil.example'],
    ['backslash after host', 'https://api.example.com\\@evil.example/'],
  ])('rejects an endpoint containing a %s', async (_name, endpoint) => {
    const { result } = setup({ baseUrl: 'https://api.example.com' });
    const error = await rejection(result.current.get(endpoint));
    expect(error).toBeInstanceOf(TypeError);
    expect(messageOf(error)).toBe('Endpoint contains forbidden characters');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    '../admin',
    '/..',
    '/a/../b',
    '/a/./b',
    './x',
    '/a/..',
    '%2e%2e/admin',
    '/a/%2E%2E/b',
    '/a/%2e/b',
    '/a/..%2fb',
    '/a/..%5cb',
    '/a/%2e%2e%2f%2e%2e/b',
    '/bad%E0%A4%A',
  ])('rejects the traversal or malformed path %j', async (endpoint) => {
    const { result } = setup({ baseUrl: '/api' });
    const error = await rejection(result.current.get(endpoint));
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports dot segments with a clear message', async () => {
    const { result } = setup({ baseUrl: '/api' });
    const error = await rejection(result.current.get('/a/../b'));
    expect(messageOf(error)).toBe('Endpoint must not contain dot segments');
  });

  it.each([
    ['https://api.example.com/v1/users', 'https://api.example.com'],
    ['HTTPS://API.EXAMPLE.COM/users', 'https://api.example.com/v1'],
    ['https://api.example.com:443/users', 'https://api.example.com'],
    ['http://localhost:3000/users?x=1', 'http://localhost:3000/api'],
  ])('allows the same-origin absolute endpoint %j', async (endpoint, baseUrl) => {
    const { result } = setup({ baseUrl });
    await settle(result.current.get(endpoint));
    expect(lastCall().url).toBe(endpoint);
  });

  it.each([
    ['another host', 'https://evil.example/x', 'https://api.example.com'],
    ['a lookalike subdomain', 'https://api.example.com.evil.example/x', 'https://api.example.com'],
    ['another port', 'https://api.example.com:8443/x', 'https://api.example.com'],
    ['a downgraded scheme', 'http://api.example.com/x', 'https://api.example.com'],
    ['an empty baseUrl', 'https://api.example.com/x', ''],
    ['a relative baseUrl', 'https://api.example.com/x', '/api'],
    ['an unparsable baseUrl', 'https://api.example.com/x', 'not a url'],
  ])('rejects an absolute endpoint on %s', async (_name, endpoint, baseUrl) => {
    const { result } = setup({ baseUrl, credentials: 'include' });
    const error = await rejection(result.current.get(endpoint));
    expect(error).toBeInstanceOf(TypeError);
    expect(messageOf(error)).toBe('Absolute endpoint must be on the same origin as baseUrl');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects absolute endpoints that carry credentials', async () => {
    const { result } = setup({ baseUrl: 'https://api.example.com' });
    const withPassword = await rejection(result.current.get('https://u:p@api.example.com/x'));
    expect(messageOf(withPassword)).toBe('Endpoint must not contain credentials');
    const withUser = await rejection(result.current.get('https://u@api.example.com/x'));
    expect(messageOf(withUser)).toBe('Endpoint must not contain credentials');
    const smuggled = await rejection(result.current.get('https://api.example.com@evil.example/x'));
    expect(messageOf(smuggled)).toBe('Endpoint must not contain credentials');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an absolute endpoint that is not a valid URL', async () => {
    const { result } = setup({ baseUrl: 'https://api.example.com' });
    const error = await rejection(result.current.get('https://'));
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('records a rejected endpoint in error state and clears loading', async () => {
    const { result } = setup({ baseUrl: '/api' });
    await settle(result.current.get('/../secret'));
    expect(result.current.error).toBeInstanceOf(TypeError);
    expect(result.current.isLoading).toBe(false);
  });

  it('trims huge runs of slashes in linear time (no ReDoS)', async () => {
    const run = '/'.repeat(300_000);
    const { result } = setup({ baseUrl: `https://api.example.com${run}` });
    const started = performance.now();
    await settle(result.current.get(`${run}users`));
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(lastCall().url).toBe('https://api.example.com/users');
  });
});

describe('useApiClient: request construction', () => {
  it('sends a bare GET with safe defaults', async () => {
    const { result } = setup();
    await settle(result.current.get('/users'));
    const { init, headers } = lastCall();
    expect(init.method).toBe('GET');
    expect(init.body).toBeNull();
    expect(init.credentials).toBe('same-origin');
    expect(init.signal).toBeUndefined();
    expect([...headers.keys()]).toEqual([]);
  });

  it.each(['include', 'omit', 'same-origin'] as const)(
    'passes credentials=%s through untouched',
    async (credentials) => {
      const { result } = setup({ credentials });
      await settle(result.current.get('/users'));
      expect(lastCall().init.credentials).toBe(credentials);
    },
  );

  it('uses the global fetch when no fetcher is injected', async () => {
    const globalFetch = vi.fn<typeof fetch>(async () => jsonResponse({ viaGlobal: true }));
    vi.stubGlobal('fetch', globalFetch);
    const { result } = renderHook(() => useApiClient());
    const outcome = await settle(result.current.get('/x'));
    expect(outcome).toEqual({ ok: true, value: { viaGlobal: true } });
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['post', (api: ReturnType<typeof useApiClient>) => api.post('/x', { a: 1 }), 'POST'],
    ['put', (api: ReturnType<typeof useApiClient>) => api.put('/x', { a: 1 }), 'PUT'],
    ['delete', (api: ReturnType<typeof useApiClient>) => api.delete('/x'), 'DELETE'],
    [
      'postFormData',
      (api: ReturnType<typeof useApiClient>) => api.postFormData('/x', new FormData()),
      'POST',
    ],
  ])('%s uses the %s verb', async (_name, call, method) => {
    const { result } = setup();
    await settle(call(result.current));
    expect(lastCall().init.method).toBe(method);
  });

  it('does not let options override the method of a helper', async () => {
    const { result } = setup();
    const sneaky = { method: 'DELETE', headers: {} };
    await settle(result.current.post('/x', { a: 1 }, sneaky));
    expect(lastCall().init.method).toBe('POST');
  });

  it('serializes a JSON body and sets the content type', async () => {
    const { result } = setup();
    await settle(result.current.post('/x', { name: 'Ada', nested: { list: [1, 2] } }));
    const { init, headers } = lastCall();
    expect(init.body).toBe('{"name":"Ada","nested":{"list":[1,2]}}');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('sends falsy-but-present bodies', async () => {
    const { result } = setup();
    for (const [value, serialized] of [
      [0, '0'],
      [false, 'false'],
      ['', '""'],
      ['text', '"text"'],
    ] as const) {
      await settle(result.current.post('/x', value));
      expect(lastCall().init.body).toBe(serialized);
      expect(lastCall().headers.get('content-type')).toBe('application/json');
    }
  });

  it('sends no body and no content type for null or undefined', async () => {
    const { result } = setup();
    await settle(result.current.post('/x'));
    expect(lastCall().init.body).toBeNull();
    expect(lastCall().headers.has('content-type')).toBe(false);
    await settle(result.current.post('/x', null));
    expect(lastCall().init.body).toBeNull();
    expect(lastCall().headers.has('content-type')).toBe(false);
  });

  it('keeps a caller-chosen content type (any casing) on JSON bodies', async () => {
    const { result } = setup();
    await settle(
      result.current.post(
        '/x',
        { a: 1 },
        { headers: { 'content-type': 'application/vnd.api+json' } },
      ),
    );
    expect(lastCall().headers.get('Content-Type')).toBe('application/vnd.api+json');
    await settle(
      result.current.put(
        '/x',
        { a: 1 },
        { headers: { 'CONTENT-TYPE': 'application/merge-patch+json' } },
      ),
    );
    expect(lastCall().headers.get('content-type')).toBe('application/merge-patch+json');
  });

  it('accepts headers as an object, tuples or a Headers instance without mutating the input', async () => {
    const { result } = setup();
    await settle(result.current.get('/x', { headers: { 'X-One': '1' } }));
    expect(lastCall().headers.get('x-one')).toBe('1');

    await settle(result.current.get('/x', { headers: [['X-Two', '2']] }));
    expect(lastCall().headers.get('x-two')).toBe('2');

    const original = new Headers({ 'X-Three': '3' });
    await settle(result.current.post('/x', { a: 1 }, { headers: original }));
    expect(lastCall().headers.get('x-three')).toBe('3');
    expect(lastCall().headers.get('content-type')).toBe('application/json');
    expect(original.has('content-type')).toBe(false);
    expect(lastCall().headers).not.toBe(original);
  });

  it('rejects header values that would enable CRLF injection', async () => {
    const { result } = setup();
    const error = await rejection(
      result.current.get('/x', { headers: { 'X-Evil': 'a\r\nSet-Cookie: pwned=1' } }),
    );
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.error).toBe(error);
  });

  it('rejects invalid header names', async () => {
    const { result } = setup();
    const error = await rejection(result.current.get('/x', { headers: { 'bad name': '1' } }));
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes FormData through untouched and lets the runtime set the boundary', async () => {
    const form = new FormData();
    form.append('file', new Blob(['hi']), 'hi.txt');
    const { result } = setup();
    await settle(result.current.postFormData('/upload', form));
    expect(lastCall().init.body).toBe(form);
    expect(lastCall().headers.has('content-type')).toBe(false);
  });

  it('strips a caller-set content type from FormData requests', async () => {
    const form = new FormData();
    const { result } = setup();
    await settle(
      result.current.postFormData('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(lastCall().headers.has('content-type')).toBe(false);
    expect(lastCall().init.body).toBe(form);
  });

  it('falls back to JSON when FormData does not exist in the runtime', async () => {
    vi.stubGlobal('FormData', undefined);
    const { result } = setup();
    await settle(result.current.post('/x', { a: 1 }));
    expect(lastCall().init.body).toBe('{"a":1}');
    expect(lastCall().headers.get('content-type')).toBe('application/json');
  });

  it('forwards the abort signal', async () => {
    const controller = new AbortController();
    const { result } = setup();
    await settle(result.current.get('/x', { signal: controller.signal }));
    expect(lastCall().init.signal).toBe(controller.signal);
  });

  it('surfaces an abort and leaves loading false', async () => {
    const controller = new AbortController();
    fetcher.mockImplementation(async (_url, init) => {
      init?.signal?.throwIfAborted();
      return jsonResponse({});
    });
    controller.abort();
    const { result } = setup();
    const error = await rejection(result.current.get('/x', { signal: controller.signal }));
    expect(nameOf(error)).toBe('AbortError');
    expect(result.current.isLoading).toBe(false);
  });

  it.each([
    ['a BigInt', () => 10n],
    [
      'a circular structure',
      () => {
        const loop: Record<string, unknown> = {};
        loop.self = loop;
        return loop;
      },
    ],
  ])('rejects %s body with a TypeError and never calls fetch', async (_name, make) => {
    const { result } = setup();
    const error = await rejection(result.current.post('/x', make()));
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['a function', () => () => 1],
    ['a symbol', () => Symbol('s')],
    ['an object whose toJSON returns undefined', () => ({ toJSON: () => undefined })],
  ])('rejects %s body as unserializable', async (_name, make) => {
    const { result } = setup();
    const error = await rejection(result.current.post('/x', make()));
    expect(messageOf(error)).toBe('Request body cannot be serialized to JSON');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('serializes __proto__ keys as plain data without touching Object.prototype', async () => {
    const payload: unknown = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const { result } = setup();
    await settle(result.current.post('/x', payload));
    expect(lastCall().init.body).toBe('{"__proto__":{"polluted":true},"safe":1}');
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('useApiClient: successful responses', () => {
  it.each([
    ['application/json', { a: 1 }],
    ['application/json; charset=utf-8', { a: 1 }],
    ['application/problem+json', { a: 1 }],
    ['application/json', null],
    ['application/json', [1, 'two']],
    ['application/json', 'just a string'],
    ['application/json', 0],
  ])('parses %s body %j', async (contentType, body) => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify(body), { headers: { 'content-type': contentType } }),
    );
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: body });
  });

  it('does not let a __proto__ key in a response pollute prototypes', async () => {
    fetcher.mockResolvedValue(
      new Response('{"__proto__":{"polluted":true},"a":1}', { headers: JSON_HEADERS }),
    );
    const { result } = setup();
    const outcome = await settle(result.current.get('/x'));
    if (!outcome.ok) throw new Error('expected success');
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect({}).not.toHaveProperty('polluted');
    expect(outcome.value).toHaveProperty('a', 1);
  });

  it('rejects malformed JSON with a SyntaxError and records it', async () => {
    fetcher.mockResolvedValue(new Response('{nope', { headers: JSON_HEADERS }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(error).toBeInstanceOf(SyntaxError);
    expect(result.current.error).toBe(error);
  });

  it.each([204, 205])('returns undefined for %i without reading the body', async (status) => {
    const response = new Response(null, { status, headers: JSON_HEADERS });
    const json = vi.spyOn(response, 'json');
    const text = vi.spyOn(response, 'text');
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: undefined });
    expect(json).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it('returns plain text for non-JSON responses', async () => {
    fetcher.mockResolvedValue(textResponse('hello'));
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: 'hello' });
  });

  it('returns text when the response has no content-type', async () => {
    fetcher.mockResolvedValue(untypedResponse('raw'));
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: 'raw' });
  });

  it('returns undefined for an empty text body', async () => {
    fetcher.mockResolvedValue(textResponse(''));
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: undefined });
  });

  it('returns undefined for content-length 0 without reading the body', async () => {
    const response = textResponse('ignored', { headers: { 'content-length': '0' } });
    const text = vi.spyOn(response, 'text');
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: undefined });
    expect(text).not.toHaveBeenCalled();
  });

  it('returns undefined for an opaque status-0 response', async () => {
    const response = textResponse('ignored');
    Object.defineProperty(response, 'status', { value: 0 });
    const text = vi.spyOn(response, 'text');
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: undefined });
    expect(text).not.toHaveBeenCalled();
  });

  it('propagates a failure while reading a text body', async () => {
    const response = textResponse('x');
    vi.spyOn(response, 'text').mockRejectedValue(new Error('stream broke'));
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('stream broke');
  });
});

describe('useApiClient: streaming', () => {
  it('postStream returns the untouched Response without consuming it', async () => {
    const response = textResponse('chunk');
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    const outcome = await settle(result.current.postStream('/chat', { prompt: 'hi' }));
    expect(outcome).toEqual({ ok: true, value: response });
    expect(response.bodyUsed).toBe(false);
    expect(lastCall().init.method).toBe('POST');
    expect(lastCall().init.body).toBe('{"prompt":"hi"}');
  });

  it('postStream still turns an error status into an Error', async () => {
    fetcher.mockResolvedValue(jsonResponse({ message: 'quota exceeded' }, { status: 429 }));
    const { result } = setup();
    const error = await rejection(result.current.postStream('/chat', {}));
    expect(messageOf(error)).toBe('quota exceeded');
    expect(result.current.error).toBe(error);
  });

  it('postStream returns a 204 response as-is instead of undefined', async () => {
    const response = new Response(null, { status: 204 });
    fetcher.mockResolvedValue(response);
    const { result } = setup();
    expect(await settle(result.current.postStream('/chat', {}))).toEqual({
      ok: true,
      value: response,
    });
  });

  it('postStream rejects when the fetcher did not return a Response', async () => {
    const response = textResponse('x');
    fetcher.mockResolvedValue(response);
    vi.stubGlobal('Response', class NotTheResponse {});
    const { result } = setup();
    const error = await rejection(result.current.postStream('/chat', {}));
    expect(messageOf(error)).toBe('Expected a streaming response');
  });

  it('postStream rejects an off-origin endpoint before any request', async () => {
    const { result } = setup({ baseUrl: 'https://api.example.com' });
    const error = await rejection(result.current.postStream('https://evil.example/x', {}));
    expect(error).toBeInstanceOf(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('useApiClient: error responses', () => {
  it('uses the message from a JSON error body', async () => {
    fetcher.mockResolvedValue(jsonResponse({ message: 'Not allowed' }, { status: 403 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(error).toBeInstanceOf(Error);
    expect(messageOf(error)).toBe('Not allowed');
    expect(result.current.error).toBe(error);
  });

  it.each([
    ['a numeric message', { message: 123 }],
    ['an object message', { message: { nested: 'x' } }],
    ['an empty message', { message: '' }],
    ['no message key', { error: 'x' }],
    ['a null payload', null],
    ['an array payload', ['message']],
    ['a string payload', 'message'],
    ['a number payload', 7],
  ])('falls back to the status for JSON with %s', async (_name, payload) => {
    fetcher.mockResolvedValue(jsonResponse(payload, { status: 422 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('Request failed with status 422');
  });

  it('falls back to the status when the JSON error body is malformed', async () => {
    fetcher.mockResolvedValue(new Response('{nope', { status: 500, headers: JSON_HEADERS }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('Request failed with status 500');
  });

  it('uses a plain-text error body', async () => {
    fetcher.mockResolvedValue(textResponse('upstream exploded', { status: 502 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('upstream exploded');
  });

  it('uses a text error body when there is no content-type', async () => {
    fetcher.mockResolvedValue(untypedResponse('bare error', { status: 500 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('bare error');
  });

  it('falls back to the status for an empty text error body', async () => {
    fetcher.mockResolvedValue(textResponse('', { status: 503 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(messageOf(error)).toBe('Request failed with status 503');
  });

  it('falls back to the status when reading the error body fails', async () => {
    const textFails = textResponse('x', { status: 500 });
    vi.spyOn(textFails, 'text').mockRejectedValue(new Error('boom'));
    fetcher.mockResolvedValueOnce(textFails);
    const { result } = setup();
    const first = await rejection(result.current.get('/x'));
    expect(messageOf(first)).toBe('Request failed with status 500');

    const jsonFails = jsonResponse({}, { status: 500 });
    vi.spyOn(jsonFails, 'json').mockRejectedValue(new Error('boom'));
    fetcher.mockResolvedValueOnce(jsonFails);
    const second = await rejection(result.current.get('/x'));
    expect(messageOf(second)).toBe('Request failed with status 500');
  });

  it('caps long server error text so it cannot flood the UI', async () => {
    fetcher.mockResolvedValueOnce(textResponse('x'.repeat(50_000), { status: 500 }));
    const { result } = setup();
    const fromText = await rejection(result.current.get('/x'));
    expect(messageOf(fromText)).toHaveLength(500);

    fetcher.mockResolvedValueOnce(jsonResponse({ message: 'y'.repeat(50_000) }, { status: 500 }));
    const fromJson = await rejection(result.current.get('/x'));
    expect(messageOf(fromJson)).toHaveLength(500);
  });

  it('keeps markup in error text inert (a string, never parsed)', async () => {
    const markup = '<img src=x onerror=alert(1)>';
    fetcher.mockResolvedValue(jsonResponse({ message: markup }, { status: 400 }));
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(typeof messageOf(error)).toBe('string');
    expect(messageOf(error)).toBe(markup);
  });
});

describe('useApiClient: thrown values', () => {
  it('rethrows the very same Error the fetcher raised', async () => {
    const failure = new TypeError('Failed to fetch');
    fetcher.mockRejectedValue(failure);
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(error).toBe(failure);
    expect(result.current.error).toBe(failure);
  });

  it.each([
    ['a string', 'nope'],
    ['undefined', undefined],
    ['an object', { code: 1 }],
    ['null', null],
  ])('wraps %s thrown by the fetcher in an Error', async (_name, thrown) => {
    fetcher.mockRejectedValue(thrown);
    const { result } = setup();
    const error = await rejection(result.current.get('/x'));
    expect(error).toBeInstanceOf(Error);
    expect(messageOf(error)).toBe('An unknown request error occurred');
    expect(result.current.error).toBe(error);
  });
});

describe('useApiClient: state', () => {
  it('starts idle with no error', () => {
    const { result } = setup();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('is loading while a request is pending and idle afterwards', async () => {
    const pending = deferred<Response>();
    fetcher.mockReturnValue(pending.promise);
    const { result } = setup();

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.get('/x');
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      pending.resolve(jsonResponse({ done: true }));
      await request;
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps an error until the next request starts, then clears it', async () => {
    fetcher.mockRejectedValueOnce(new Error('first failed'));
    const { result } = setup();
    await settle(result.current.get('/x'));
    expect(result.current.error?.message).toBe('first failed');
    expect(result.current.isLoading).toBe(false);

    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    let request!: Promise<unknown>;
    act(() => {
      request = result.current.get('/x');
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      pending.resolve(jsonResponse({}));
      await request;
    });
    expect(result.current.error).toBeNull();
  });

  it('stays loading until every concurrent request has finished', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup();

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.get('/a');
      b = result.current.get('/b');
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      second.resolve(jsonResponse({}));
      await b;
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      first.resolve(jsonResponse({}));
      await a;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps a failure visible when a concurrent request succeeds afterwards', async () => {
    const failing = deferred<Response>();
    const succeeding = deferred<Response>();
    fetcher.mockReturnValueOnce(failing.promise).mockReturnValueOnce(succeeding.promise);
    const { result } = setup();

    let a!: Promise<unknown>;
    let b!: Promise<unknown>;
    act(() => {
      a = result.current.get('/a');
      b = result.current.get('/b');
    });
    await act(async () => {
      failing.reject(new Error('a failed'));
      await a.catch(() => undefined);
    });
    await act(async () => {
      succeeding.resolve(jsonResponse({}));
      await b;
    });
    expect(result.current.error?.message).toBe('a failed');
    expect(result.current.isLoading).toBe(false);
  });

  it('settles quietly when the component unmounts mid-request', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pending = deferred<Response>();
    fetcher.mockReturnValue(pending.promise);
    const { result, unmount } = setup();

    let request!: Promise<unknown>;
    act(() => {
      request = result.current.get('/x');
    });
    unmount();
    pending.resolve(jsonResponse({ late: true }));
    await expect(request).resolves.toEqual({ late: true });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps the same api object across renders with unchanged options', () => {
    const { result, rerender } = setup({ baseUrl: '/api' });
    const first = result.current.get;
    rerender({ fetcher, baseUrl: '/api' });
    expect(result.current.get).toBe(first);
  });

  it.each([
    ['baseUrl', { baseUrl: '/other' }],
    ['credentials', { credentials: 'include' as const }],
    ['fetcher', { fetcher: vi.fn<typeof fetch>(async () => jsonResponse({})) }],
  ])('builds a new api object when %s changes', (_name, change) => {
    const { result, rerender } = setup({ baseUrl: '/api' });
    const first = result.current.get;
    rerender({ fetcher, baseUrl: '/api', ...change });
    expect(result.current.get).not.toBe(first);
  });

  it('uses the latest options for the next request', async () => {
    const other = vi.fn<typeof fetch>(async () => jsonResponse({ from: 'other' }));
    const { result, rerender } = setup({ baseUrl: '/one' });
    rerender({ fetcher: other, baseUrl: '/two', credentials: 'include' });
    expect(await settle(result.current.get('/x'))).toEqual({ ok: true, value: { from: 'other' } });
    expect(other).toHaveBeenCalledWith(
      '/two/x',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
