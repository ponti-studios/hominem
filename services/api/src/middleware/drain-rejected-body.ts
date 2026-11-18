import type { MiddlewareHandler } from 'hono';

// A rejected request (401, 413, 403, ...) can leave its body unread. When the server then
// closes that socket with bytes still unread, the OS sends a TCP reset instead of a clean
// close. The client can throw away the 401 or 413 it hasn't read yet and see a network
// error. Reading and discarding the body first lets the socket close cleanly.
//
// Bodies are never buffered, only counted. Past the cap we stop reading, so an oversized
// body can still reset. The cap is a little over the largest normal body (see
// body-limit.ts), so anything the limiter rejects in that range closes cleanly.

const MIB = 1024 * 1024;
export const DRAIN_MAX_BYTES = 2 * MIB;

export function drainRejectedBody(maxBytes = DRAIN_MAX_BYTES): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status < 400) return;

    const body = c.req.raw.body;
    if (!body || c.req.raw.bodyUsed) return;

    const reader = body.getReader();
    let seen = 0;
    let done = false;
    try {
      while (seen < maxBytes) {
        const result = await reader.read();
        if (result.done) {
          done = true;
          return;
        }
        seen += result.value.byteLength;
      }
    } catch {
      // The client went away mid-upload. Nothing left to drain.
      done = true;
    } finally {
      // Only cancel when we stopped early. A fully read body needs no cancel.
      if (!done) await reader.cancel().catch(() => {});
    }
  };
}
