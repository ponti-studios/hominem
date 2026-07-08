# PLAN — Fix Hono RPC Type Flow

## Problem

`createFinanceClient` has 15 `as Promise<Foo>` casts because `api-client.ts` erases all Hono types:

```ts
export interface RpcResponse {
  json(): Promise<unknown>;  // ← destroys type inference
}
export function createApiClient(config): HonoClient {
  return client as unknown as HonoClient;  // ← double erase
}
```

The `FinanceClient` interface and `Finance*Input` wrappers exist solely to recover the types that were destroyed.

## Fix

### Step 1 — Export `AppType` from server

`services/api/src/server.ts`:
- `export const app = createServer()` (currently the app is only used internally)
- `export type AppType = typeof app`

Or better — export just the type so the client can use `hc<AppType>()`.

### Step 2 — Fix `api-client.ts`

Replace the whole `RpcResponse`/`RpcBranch`/`HonoClient` manual type layer with:

```ts
import { hc } from 'hono/client';
import type { AppType } from '@hominem/api';  // or wherever AppType lives

export function createApiClient(config) {
  return hc<AppType>(config.baseUrl, { fetch: ... });
}
```

No more `as unknown as`. The return type of `hc<AppType>()` IS the typed client. `res.json()` returns the actual typed data.

### Step 3 — Delete `FinanceClient` + `Finance*Input` + output aliases from RPC

When `res.json()` is typed natively, `createFinanceClient` no longer needs:
- `FinanceClient` interface (types inferred from server)
- `Finance*Input` interfaces (input types inferred from server route validators)
- All `*Output` type aliases (output types inferred from `c.json<T>()` returns)
- All `as Promise<>` casts

`createFinanceClient` becomes a thin adapter that maps method names to Hono client calls:

```ts
export function createFinanceClient(rawClient: AppType) {
  return {
    listAccounts: (input) => rawClient.api.finance.accounts.list.$get({ query: input }).then(r => r.json()),
    getAccount: (input) => rawClient.api.finance.accounts.get.$get({ query: input }).then(r => r.json()),
    // ...
  }
}
```

Return types are inferred — no manual annotation needed.

### Step 4 — Remove `packages/rpc/src/core/raw-client.ts`

Just imports `HonoClient` from `api-client.ts`. Gone.

### Step 5 — Fix consumers

`apps/finance/app/lib/api/client.ts` and `api.server.ts` — the `createServerHonoClient` function type may change slightly. The `useHonoQuery` generic params should still work since the types flow.

### What stays in `packages/rpc/src/finance.ts`

Only the shared data types actually used across the boundary:
- `AccountData`, `TransactionData`, `InstitutionData`, `PlaidConnection`, etc. (the DB row shape subsets)
- `Merchant`, `TagBreakdownItem`, `MonthlyStatsOutput`, etc. (computed analytics shapes)
- `BudgetCategoryData`, `BudgetCalculateInput/Output`, etc.

### What gets deleted from `packages/rpc/src/finance.ts`

- `FinanceClient` interface (~16 lines)
- `Finance*Input` interfaces (~30 lines)  
- `createFinanceClient` function (~60 lines) — replaced by thin wrapper
- `EmptyInput` (no longer needed — Hono routes declare their own input types)
- All `*Output` aliases that are pure renames (`AccountListOutput = AccountData[]`, etc.) — types flow from routes

### Dependency
- `services/api/src/server.ts` needs to export its type — creates a dependency from `packages/rpc` → `services/api`. Currently the dependency is `services/api → packages/rpc`. This would reverse it or create a trilemma.
- Alternative: export the type from `packages/rpc` itself by having the server composition function there. Or, create a shared type package.

### Simpler approach

Don't export AppType from the server. Instead, fix `api-client.ts` to preserve types WITHOUT depending on the server:

Export `AppType` from the **RPC package itself** — since the route definitions are in `services/api/src/rpc/routes/`, the RPC package can import them and compose the app type.

Actually the simplest: `services/api/src/rpc/app.ts` already combines all routes. Export THAT type:

```ts
// packages/rpc/src/core/api-client.ts
import type { AppType } from '../../../../services/api/src/rpc/app'; // wrong direction!
```

This creates a reverse dependency. 

### Reality check

The proper Hono RPC approach requires the client to know the server's route types. This can work if:
1. Server exports `AppType`
2. Client imports `AppType` and passes to `hc<AppType>()`

The dependency chain is: `client → AppType ← server`. Both client and server depend on the type, but the type is defined in the server. This is fine for monorepos — the client just imports a type, not a runtime value.

The simplest path: **move the `AppType` definition to `packages/rpc`**. The route files are already in `services/api/src/rpc/routes/`, so the RPC routes know their own types. We just need to export the combined app type from the RPC package.

Actually, `services/api/src/rpc/app.ts` IS the combined app. If we just export its type from there...

But the RPC package can't import from the service. Let me check the current import direction:

- `services/api/package.json` depends on `@hominem/rpc`
- `apps/finance/package.json` depends on `@hominem/rpc`

So `services/api → @hominem/rpc` and `apps/finance → @hominem/rpc`. The fix is: **move the app type export to `@hominem/rpc`** and have the API server re-export/use it.

This means: `@hominem/rpc` exports the combined Hono route type `FinanceAppType`, and both the server and client use it. No circular deps.

## Implementation order

1. Create `packages/rpc/src/app-type.ts` — import route definitions, build app type
2. Fix `api-client.ts` — use `hc<AppType>()`, no more `unknown`-cast
3. Update `server.ts` to use the app type from RPC
4. Rewrite `createFinanceClient` — no more `as Promise<>`, no `FinanceClient` interface
5. Delete dead exports from `finance.ts`
6. Clean up consumers
7. Run typecheck + tests
