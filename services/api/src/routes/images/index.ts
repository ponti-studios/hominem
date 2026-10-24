import { createHash } from 'crypto';

import { redis as cache } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';
import type { Context } from 'hono';
import { Hono } from 'hono';

import {
  ForbiddenError,
  InternalError,
  isServiceError,
  UnavailableError,
  ValidationError,
} from '../../errors';
import type { AppEnv } from '../../server';

const ALLOWED_HOST_SUFFIXES = ['googleusercontent.com'];
const ALLOWED_HOSTS = ['maps.googleapis.com', 'places.googleapis.com'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

// https only, and only hosts Google runs for images. Deliberately NOT all of googleapis.com:
// storage.googleapis.com serves anyone's bucket, so that would let a caller host content on us.
export function isAllowedImageUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const hostname = parsed.hostname.toLowerCase();
    return (
      ALLOWED_HOSTS.includes(hostname) ||
      ALLOWED_HOST_SUFFIXES.some((base) => hostname.endsWith(`.${base}`))
    );
  } catch {
    return false;
  }
}

// SVG can carry script, so it never goes through even though it's image/*.
export function isSafeImageContentType(contentType: string | null): contentType is string {
  if (!contentType) return false;
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return type.startsWith('image/') && !type.includes('svg');
}

// Follows redirects by hand so every hop is re-checked against the allowlist.
async function fetchAllowed(url: string): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isAllowedImageUrl(current)) {
      throw new ForbiddenError('Domain not allowed', undefined, 'image.domain_not_allowed');
    }
    const response = await fetch(current, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)' },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) break;
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new UnavailableError('Too many redirects', undefined, 'image.upstream_failed');
}

// Reads the body chunk by chunk and bails the moment it passes the cap, so a huge
// upstream can't be buffered into memory first.
async function readCapped(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new UnavailableError('Image exceeds 5MB limit', undefined, 'image.size_limit_exceeded');
  }
  if (!response.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UnavailableError('Image exceeds 5MB limit', undefined, 'image.size_limit_exceeded');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export const imagesRoutes = new Hono<AppEnv>();

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h
const LOCK_TTL_SECONDS = 15;

function getCacheKey(url: string) {
  const hash = createHash('sha256').update(url).digest('hex');
  return `image:proxy:${hash}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function setResponseHeaders(
  c: Context<AppEnv>,
  options: {
    contentType: string;
    etag?: string | null;
    cacheStatus?: 'hit' | 'miss';
  },
) {
  // Wide open on purpose — this proxy needs to work from any origin, so it doesn't
  // use the app-level API CORS allowlist. Host allowlisting below covers security instead.
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET');
  c.header('Content-Type', options.contentType);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Security-Policy', "default-src 'none'; sandbox");
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
  c.header(
    'Cache-Control',
    'public, max-age=86400, stale-while-revalidate=86400, stale-if-error=86400',
  );
  if (options.etag) {
    c.header('ETag', options.etag);
  }
  if (options.cacheStatus) {
    c.header('X-Image-Cache', options.cacheStatus);
  }
}

// Proxies external images (/api/images/proxy?url=...) to dodge CORB/CORS issues.
// Returns raw binary image data on success, not the usual ApiResult shape —
// errors still go through ApiResult though, for consistency.
imagesRoutes.get('/proxy', async (c) => {
  const imageUrl = c.req.query('url');

  if (!imageUrl) {
    throw new ValidationError('URL parameter is required', undefined, 'image.url_required');
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl);

    if (!isAllowedImageUrl(decodedUrl)) {
      throw new ForbiddenError('Domain not allowed', undefined, 'image.domain_not_allowed');
    }

    const cacheKey = getCacheKey(decodedUrl);
    const cacheTypeKey = `${cacheKey}:type`;
    const cacheEtagKey = `${cacheKey}:etag`;
    const lockKey = `${cacheKey}:lock`;

    const readCached = async () => {
      const cachedBody = await cache.getBuffer(cacheKey);
      if (!cachedBody) return null;
      const cachedType = (await cache.get(cacheTypeKey)) || 'image/jpeg';
      const cachedEtag = (await cache.get(cacheEtagKey)) || null;
      return { cachedBody, cachedType, cachedEtag };
    };

    const initialCached = await readCached();
    if (initialCached) {
      const ifNoneMatch = c.req.header('If-None-Match');
      if (initialCached.cachedEtag && ifNoneMatch === initialCached.cachedEtag) {
        setResponseHeaders(c, {
          contentType: initialCached.cachedType,
          etag: initialCached.cachedEtag,
          cacheStatus: 'hit',
        });
        return c.body(null, 304);
      }
      setResponseHeaders(c, {
        contentType: initialCached.cachedType,
        etag: initialCached.cachedEtag,
        cacheStatus: 'hit',
      });
      return c.body(new Uint8Array(initialCached.cachedBody));
    }

    const lockValue = crypto.randomUUID();
    const lockResult = await cache.set(lockKey, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!lockResult) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        await sleep(200);
        const cached = await readCached();
        if (cached) {
          const ifNoneMatch = c.req.header('If-None-Match');
          if (cached.cachedEtag && ifNoneMatch === cached.cachedEtag) {
            setResponseHeaders(c, {
              contentType: cached.cachedType,
              etag: cached.cachedEtag,
              cacheStatus: 'hit',
            });
            return c.body(null, 304);
          }
          setResponseHeaders(c, {
            contentType: cached.cachedType,
            etag: cached.cachedEtag,
            cacheStatus: 'hit',
          });
          return c.body(new Uint8Array(cached.cachedBody));
        }
      }
    }

    const response = await fetchAllowed(decodedUrl);

    if (!response.ok) {
      await response.body?.cancel();
      throw new UnavailableError(
        `Failed to fetch image: ${response.statusText}`,
        undefined,
        'image.upstream_failed',
      );
    }

    const upstreamType = response.headers.get('content-type');
    if (!isSafeImageContentType(upstreamType)) {
      await response.body?.cancel();
      throw new UnavailableError('Upstream is not an image', undefined, 'image.upstream_failed');
    }
    const contentType = upstreamType.split(';')[0]!.trim().toLowerCase();
    const imageBuffer = await readCapped(response, MAX_IMAGE_BYTES);
    const etag = `"${createHash('sha256').update(imageBuffer).digest('hex')}"`;

    try {
      await Promise.all([
        cache.set(cacheKey, imageBuffer, 'EX', CACHE_TTL_SECONDS),
        cache.set(cacheTypeKey, contentType, 'EX', CACHE_TTL_SECONDS),
        cache.set(cacheEtagKey, etag, 'EX', CACHE_TTL_SECONDS),
      ]);
    } catch (cacheError) {
      logger.warn('image_cache_write_failed', {
        operation: 'image.cache.write',
        failureType: 'image.cache_write_failed',
        error_name: cacheError instanceof Error ? cacheError.name : 'unknown',
      });
    } finally {
      try {
        if (lockResult) {
          await cache.del(lockKey);
        }
      } catch (releaseError) {
        logger.warn('image_cache_lock_release_failed', {
          operation: 'image.cache.lock_release',
          failureType: 'image.cache_lock_release_failed',
          error_name: releaseError instanceof Error ? releaseError.name : 'unknown',
        });
      }
    }

    setResponseHeaders(c, { contentType, etag, cacheStatus: 'miss' });
    return c.body(new Uint8Array(imageBuffer));
  } catch (err) {
    if (isServiceError(err)) throw err;
    logger.error('image_proxy_failed', {
      operation: 'image.proxy',
      failureType: 'image.proxy_failed',
      error_name: err instanceof Error ? err.name : 'unknown',
    });
    throw new InternalError('Failed to proxy image', undefined, 'image.proxy_failed');
  }
});
