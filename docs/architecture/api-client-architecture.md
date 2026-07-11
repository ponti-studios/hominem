# API and client architecture

## Purpose

Keep all product clients on a single authenticated capability boundary.

## Canonical boundary

`@hominem/db` owns persistence repositories. Application services own domain behavior. Hono RPC exposes typed DTOs derived from runtime schemas. Web/domain apps use Better Auth cookies; Omiro uses Better Auth's supported mobile bearer surface.

## Invariants

Clients never access Postgres, object storage, or internal repository rows. Transport DTOs are mapped from domain/read models, not reused database rows. Every route validates input, resolves identity, authorizes scope, calls a service, and returns stable errors.

## Privacy and AI evidence

The same sensitivity and evidence policy applies to RPC and MCP. Client-specific convenience cannot bypass RLS or service authorization.

## Rejected models

- Direct database access from apps.
- Separate mobile and web domain semantics.
- Manually duplicated API TypeScript types.

## Cross-cutting implementation rules

- `@hominem/db` repositories stay persistence-only and do not return transport DTOs.
- Application services own authorization, domain behavior, and read-model assembly.
- Hono RPC routes validate inputs with runtime schemas and map service outputs and typed errors to DTOs.
- Web, mobile, domain apps, and MCP consume the same service capabilities.
- Domain acceptance criteria cover schema validation, stable errors, DTO redaction, and route authorization.
- Production credential isolation and mobile bearer auth hardening remain deferred until MVP needs them.

## Open questions

None.
