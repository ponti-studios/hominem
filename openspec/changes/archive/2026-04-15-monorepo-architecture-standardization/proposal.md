## Why

The monorepo currently mixes domain logic, persistence, transport shapes, and UI-facing types in ways that make boundaries hard to reason about and easy to violate. We need a single enforceable architecture so new work is consistent, explicit, and scalable across web, mobile, API, RPC, and data layers.

## What Changes

- Standardize layer boundaries across the monorepo with explicit domain, data, RPC, and UI responsibilities.
- Normalize file naming around suffix-based roles such as `*.types.ts`, `*.schema.ts`, `*.db.ts`, `*.rpc.ts`, `*.mapper.ts`, `*.service.ts`, `*.repository.ts`, `*.vm.ts`, and `*.hooks.ts`.
- Replace ambiguous shared patterns with clearly owned packages and boundary-specific modules.
- Make cross-layer transitions explicit through mappers instead of reusing one shape everywhere.
- Add enforceable dependency direction so UI cannot reach into persistence internals and lower layers stay free of app-specific concerns.

## Capabilities

### New Capabilities
- `monorepo-architecture-standardization`: repository-wide rules for layer separation, naming, and boundary transitions.

### Modified Capabilities
- None

## Impact

Affected areas include app structure, package organization, import direction, runtime validation, and boundary mapping across the monorepo. Existing ambiguous files and legacy naming patterns will need to be rewritten or relocated to fit the standardized architecture.
