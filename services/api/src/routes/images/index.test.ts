import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hominem/services/redis', () => ({
  redis: {
    getBuffer: vi.fn(async () => null),
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  },
}));

import { isServiceError } from '../../errors';
import { imagesRoutes, isAllowedImageUrl, isSafeImageContentType } from './index';

const app = new Hono()
  .route('/api/images', imagesRoutes)
  .onError((err, c) =>
    c.json(
      { error: isServiceError(err) ? err.message : 'unknown' },
      isServiceError(err) ? 400 : 500,
    ),
  );

const proxy = (url: string) => app.request(`/api/images/proxy?url=${encodeURIComponent(url)}`);
const GOOD = 'https://lh3.googleusercontent.com/a/photo';

describe('isAllowedImageUrl', () => {
  it.each([
    GOOD,
    'https://maps.googleapis.com/maps/api/place/photo?x=1',
    'https://places.googleapis.com/v1/photo',
  ])('allows %s', (url) => expect(isAllowedImageUrl(url)).toBe(true));

  it.each([
    'http://lh3.googleusercontent.com/a',
    'https://storage.googleapis.com/someones-bucket/x.html',
    'https://googleusercontent.com.evil.com/a',
    'https://evil.com/?https://lh3.googleusercontent.com/a',
    'https://user:pw@lh3.googleusercontent.com/a',
    'https://lh3.googleusercontent.com:8443/a',
    'https://169.254.169.254/latest/meta-data',
    'http://localhost:4040/',
    'file:///etc/passwd',
    'not a url',
  ])('rejects %s', (url) => expect(isAllowedImageUrl(url)).toBe(false));
});

describe('isSafeImageContentType', () => {
  it('accepts raster images, rejects svg/html/missing', () => {
    expect(isSafeImageContentType('image/png')).toBe(true);
    expect(isSafeImageContentType('image/jpeg; charset=binary')).toBe(true);
    expect(isSafeImageContentType('image/svg+xml')).toBe(false);
    expect(isSafeImageContentType('text/html')).toBe(false);
    expect(isSafeImageContentType(null)).toBe(false);
  });
});

describe('GET /api/images/proxy', () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('serves an image with locked-down headers', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    );
    const res = await proxy(GOOD);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses disallowed hosts without fetching', async () => {
    const res = await proxy('http://169.254.169.254/');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-checks redirects and blocks hops to internal hosts', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/x' } }),
    );
    const res = await proxy(GOOD);
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect to another allowed host', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://lh4.googleusercontent.com/b' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([9]), { headers: { 'content-type': 'image/webp' } }),
      );
    expect((await proxy(GOOD)).status).toBe(200);
  });

  it('rejects non-image and svg upstreams', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>', { headers: { 'content-type': 'text/html' } }),
    );
    expect((await proxy(GOOD)).status).toBe(400);
    fetchMock.mockResolvedValue(
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    );
    expect((await proxy(GOOD)).status).toBe(400);
  });

  it('stops reading once the stream passes 5MB', async () => {
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    fetchMock.mockResolvedValue(new Response(body, { headers: { 'content-type': 'image/png' } }));
    const res = await proxy(GOOD);
    expect(res.status).toBe(400);
    expect(pulled).toBeLessThan(10);
  });
});
