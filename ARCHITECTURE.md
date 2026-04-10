# Architecture

## Surfaces

- `apps/web`: browser app and routes
- `apps/mobile`: Expo app and native screens
- `services/api`: Hono API, auth, workers, and data access

## Shared Packages

- `packages/core`: config, env, db, and utility primitives
- `packages/platform`: shared hooks, UI, auth, rpc, telemetry, and queues
- `packages/domains`: domain-specific building blocks where they still add value

## Direction

- Apps consume shared packages.
- Shared packages do not depend on app code.
- `services/api` owns server-only orchestration and persistence.

## Cleanup Outcomes

- Removed thin repository/service passthrough layers where they added no value.
- Consolidated shared hooks and env parsing.
- Standardized query keys and error handling.
- Fixed archive behavior to soft delete notes instead of hard deleting them.
