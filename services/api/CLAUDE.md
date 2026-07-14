# CLAUDE.md — services/api

Hono HTTP server + BullMQ worker. Two entry points: `src/index.ts` (HTTP) and `src/worker.ts` (jobs).

## Typed context

`AppEnv` (in `src/server.ts`) declares Hono's context variable map. Auth middleware sets `ctx.var.user`, `ctx.var.userId`, and `ctx.var.auth` — read from there, do not re-fetch the user inside route handlers.

```ts
import type { AppEnv } from '../server';
const route = new Hono<AppEnv>();
```

## Adding a route

1. Create `src/routes/<name>.ts`, export a `Hono<AppEnv>` instance
2. Register it in `src/server.ts` with `app.route('/path', myRoutes)`
3. If the route needs auth, apply `authJwtMiddleware` — it's already wired globally but can be applied per-route for finer control

## RPC contract

`src/rpc/app.ts` is the type-safe contract consumed by client packages via `@hominem/api/types`. Any change to RPC types is a breaking change for `apps/career` and `apps/omiro` — update clients in the same PR.

## Error handling

Use `isServiceError` from `src/errors.ts` to distinguish known domain errors from unexpected ones. Throw typed errors; the global error handler in `src/server.ts` maps them to HTTP status codes.

## Workers (BullMQ)

Job handlers live in `src/workers/`. Register them in `src/worker.ts`. Workers run as a separate process — they don't share memory with the HTTP server.

## Build

```bash
node build.mjs    # custom rolldown build → dist/index.mjs + dist/worker.mjs
just test api      # API test lane
just dev api       # watch mode
```

Standard `turbo build` does not work here — always use `node build.mjs`.
