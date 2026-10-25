import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

const KB = 1024;
const MB = 1024 * KB;

// Everything we serve is small JSON or a form post. Uploads are the one exception.
const DEFAULT_MAX_BYTES = 1 * MB;
const UPLOAD_MAX_BYTES = 25 * MB;

export function maxBodyBytesFor(method: string, path: string) {
  if (method === 'POST' && (path === '/api/files' || path === '/api/files/'))
    return UPLOAD_MAX_BYTES;
  return DEFAULT_MAX_BYTES;
}

// Hono checks Content-Length up front and counts streamed bytes otherwise, so an oversized body is
// rejected before the handler buffers it.
//
// Methods that never carry a body skip it. The Node adapter still exposes a body stream on OPTIONS,
// and bodyLimit's re-wrap of that request throws, which turned every CORS preflight into a 500.
const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requestBodyLimit(): MiddlewareHandler {
  const limiters = new Map<number, MiddlewareHandler>();
  return (c, next) => {
    if (BODYLESS_METHODS.has(c.req.method)) return next();
    const maxSize = maxBodyBytesFor(c.req.method, c.req.path);
    let limiter = limiters.get(maxSize);
    if (!limiter) {
      limiter = bodyLimit({
        maxSize,
        onError: (ctx) =>
          ctx.json({ error: 'payload_too_large', message: 'Request body too large.' }, 413),
      });
      limiters.set(maxSize, limiter);
    }
    return limiter(c, next);
  };
}
