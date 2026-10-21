// Server-only entrypoint: the internal RPC client gets the shared keep-alive
// undici dispatcher. Never import this from a module that also renders in the
// browser — use `@hominem/rpc` there instead.
export { createApiClient } from '@hominem/rpc/server';
