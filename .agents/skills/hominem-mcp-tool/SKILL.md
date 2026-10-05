---
name: hominem-mcp-tool
description: >
  Add or extend MCP tools in the hominem API: register a tool with
  registerTool in services/api/src/mcp/tools/<domain>.ts, wire its
  scope(s) in services/api/src/scopes.ts and
  services/api/src/application/capability.ts, gate its import in
  services/api/src/mcp/register-tools.ts, and cover it with a
  tools/<domain>-crud.test.ts (or <domain>.test.ts) integration test. Use
  when adding a new MCP-callable capability (read or write), adding a tool
  to an existing domain file, or reviewing whether new tool code follows
  the registerTool conventions (resultCap, requiresConfirmation, preview,
  guidance).
license: MIT
compatibility: Hominem API service work (services/api/src/mcp).
metadata:
  author: project
  version: '1.0'
  category: API
  tags:
    - api
    - mcp
    - zod
    - tools
when:
  - adding a new MCP tool, or a new domain of MCP tools
  - adding a tool to an existing services/api/src/mcp/tools/<domain>.ts file
  - reviewing a new registerTool call for resultCap/scope/confirmation correctness
termination:
  - The tool is registered, scoped, gated, and covered by a passing integration test
  - services/api typechecks and its full test suite passes
outputs:
  - A registered MCP tool (and, for a new domain, capability + scope wiring) plus tests
argumentHint: the domain/tool name to add (e.g. "task", "career_profile_update")
---

# Add an MCP tool to hominem

This skill covers the **MCP surface only** — `registerTool` wiring, scopes, and MCP tool
tests. If the resource also needs to be reachable over REST (`rpc/routes`) or a web UI, use
the broader `hominem-resource` skill instead; that skill's "thin adapter over one shared
service" rule still applies here even when MCP is the only surface.

## Two situations

1. **Adding a tool to an existing domain** (e.g. another `career_*` tool) — skip straight to
   step 4 below; the capability, scope, and register-tools.ts wiring already exist.
2. **Adding a brand-new domain** (e.g. the `task` capability added in this repo) — do all
   steps in order.

## Where files live

| Layer                 | Path                                               | Owns                                                |
| --------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Capability + scopes   | `services/api/src/application/capability.ts`       | `CAPABILITIES` array, `CapabilityDefinition` type   |
| Scope registry        | `services/api/src/scopes.ts`                       | `MCP_SCOPES`, `MCP_ENABLED_SCOPES`                  |
| Tool registration     | `services/api/src/mcp/register-tools.ts`           | Conditional `import('./tools/<domain>')` per scope  |
| Tool registry/runtime | `services/api/src/mcp/tool-registry.ts`            | `registerTool`, `callTool`, `resultCap` enforcement |
| Schemas               | `services/api/src/schemas/<domain>.schema.ts`      | Zod input/output shapes                             |
| Service               | `services/api/src/application/<domain>.service.ts` | Query/business logic, `ownerUserId`-scoped          |
| Tool wiring           | `services/api/src/mcp/tools/<domain>.ts`           | `registerTool` calls only, no business logic        |
| Chat routing fallback | `services/api/src/mcp/chat-tool-adapter.ts`        | `inferMuseCapabilities` keyword table (optional)    |
| Tests                 | `services/api/src/mcp/tools/<domain>-crud.test.ts` | Registration + CRUD + cross-user isolation          |

## Steps

### 1. Register the capability (new domain only)

Add the domain name to `CAPABILITIES` in `application/capability.ts`, **alphabetically**:

```ts
export const CAPABILITIES = [
  'career',
  // ...
  'tags',
  'task', // <- new entry, alphabetical
  'travel',
] as const;
```

`Capability` and the `Scope = \`${Capability}:${ScopeAction}\`` template type are derived from
this array, so a typo'd scope string elsewhere becomes a compile error instead of a tool that
silently drops out of routing at runtime.

### 2. Register the scope(s)

Add `<domain>:read` and/or `<domain>:write` to `MCP_SCOPES` in `scopes.ts`, alphabetically:

```ts
export const MCP_SCOPES = [
  // ...
  'tags:write',
  'task:read',
  'task:write',
  'travel:read',
] as const;
```

Only add `:write` if the domain has at least one mutating tool. `MCP_ENABLED_SCOPES` defaults
to all of `MCP_SCOPES` — leave it alone unless you're deliberately trimming what's registered.

### 3. Gate the tool file import (new domain only)

In `register-tools.ts`, add a conditional import next to the others (exact position in the
list doesn't matter — it isn't strictly alphabetized there, just append near the rest):

```ts
if (isEnabled('task:read', 'task:write')) imports.push(import('./tools/tasks'));
```

`isEnabled` is `some`, not `every` — listing both scopes means the file registers if _either_
is enabled, and each individual tool's own `scopes` array is what's actually enforced per-call.

### 4. Define schemas

In `schemas/<domain>.schema.ts`: one output schema per resource shape, one input schema per
operation. Reuse existing helpers/idioms from a sibling schema file (`career.schema.ts`,
`tasks.schema.ts`) rather than inventing new validation. Two things that have caused real bugs:

- **`outputSchema` must match the service's return shape exactly.** `callTool` re-parses the
  service result against it (`tool-registry.ts`'s `callTool`) and throws on mismatch. Use
  `.nullable()` wherever the service can return `null` (the not-found convention below).
- **A `refine` requiring at least one field** is needed on any partial-update schema
  (`.partial().refine((data) => Object.keys(data).length > 0, ...)`) — without it, an empty
  `{}` payload reaches the DB as a no-op empty-`SET` update. See `careerProfileUpdateSchema` /
  `UpdateTaskSchema` for the pattern.

### 5. Write (or extend) the service — the nullable/boolean not-found convention

MCP tools **never throw for an expected "not found."** If the underlying repository throws
`NotFoundError` (from `@hominem/db/errors`) when a row doesn't exist or isn't owned by the
caller, the application service wraps it:

```ts
export async function updateTask(ownerUserId: string, id: string, patch: UpdateTaskInput) {
  try {
    return await TaskRepository.update(db, id, ownerUserId, patch);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
```

This lets a `preview` function and a write tool's handler treat "not found" as ordinary data
(`{ task: null }` / `{ removed: false }`) instead of an MCP error. `NotFoundError` has correct
`Object.setPrototypeOf`, so `instanceof NotFoundError` is safe to rely on.

If the same service also backs an RPC route, the route maps the `null` / `false` back to
`NotFoundError` (404); see the `hominem-resource` skill.

Exception: a _create_-time reference check (e.g. an invalid `parentTaskId`) is a genuine client
error, not a "used to exist" case — leave that one throwing.

Every query must be scoped by `ownerUserId`/`ownerUserid` — `app.*` tables are RLS-forced but
the service role bypasses RLS, so the service is the only thing preventing cross-user reads.

Two DB-layer gotchas worth checking for in any new list/detail service:

- **Kysely `CamelCasePlugin` + `.as('literal_name')`**: aliasing a computed column with a
  snake_case string (`.as('child_count')`) compiles fine but is silently renamed to
  `childCount` in the actual JS result at runtime — always alias with the camelCase form
  directly (`.as('childCount')`) so compile-time type and runtime key agree.
- **`resultCap` vs. the actual query bound**: a tool declaring `resultCap: 100` but backed by
  an unbounded query will hard-fail once real data exceeds 100. The query itself needs a
  matching `.limit(...)`, not just the tool definition's cap.

### 6. Register the tool(s)

In `mcp/tools/<domain>.ts`, call `registerTool` per operation:

```ts
import { registerTool } from '../tool-registry';

// Baseline for a "create" tool (destructive: false, idempotent: false — each
// call produces a new row). Update/complete/delete tools override both below.
const writeTool: {
  readOnly: false;
  scopes: ['task:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['task:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

registerTool(
  {
    name: 'task_list',
    title: 'List tasks',
    description: 'Lists top-level tasks and task lists for the authenticated user.',
    inputSchema: TaskListQuerySchema,
    outputSchema: taskListResultSchema,
    readOnly: true,
    scopes: ['task:read'],
    resultCap: 100,
  },
  async (ownerUserId, input) => ({ tasks: await listTasks(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'task_delete',
    title: 'Delete a task',
    description: 'Deletes a task. If it is a task list, its child tasks are deleted too.',
    inputSchema: TaskParamSchema,
    outputSchema: z.object({ removed: z.boolean() }),
    guidance: {
      whenToUse: 'A matching task id has been returned by task_list or task_detail.',
      whenNotToUse: 'Do not invent a task id or delete before lookup and confirmation.',
      dependencies: [{ tool: 'task_list', reason: 'resolve the stable task id', provides: ['id'] }],
    },
    preview: async (ownerUserId, input) => {
      const parsed = TaskParamSchema.safeParse(input);
      if (!parsed.success) return null;
      const { task } = await getTaskDetail(ownerUserId, parsed.data.id);
      return task ? { title: task.title, artifactType: task.artifactType } : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await deleteTask(ownerUserId, input.id) }),
);
```

Conventions to follow:

- Use a shared `writeTool` object (spread with `...writeTool`) for the fields every write tool
  in the file repeats — mirrors `career.ts`.
- Use `const noInputSchema = z.object({})` for parameterless read tools.
- `readOnly: true` for reads; write tools must list a `:write` scope.
- Every write tool must set `destructive`/`idempotent` explicitly — the server's fallback
  treats an unannotated write as destructive and non-idempotent (the spec's "assume the worst"
  default), which mislabels safe operations like `task_complete`. Deletes/removes →
  `destructive: true`; everything else (creates, field updates, complete/reopen, save/replace)
  → `destructive: false`. A repeatable no-op-on-repeat operation (delete, update-to-a-value,
  complete/reopen) → `idempotent: true`; a pure append/create that produces a new row each
  call → `idempotent: false`.
- `requiresConfirmation: true` + a `preview` function for anything destructive (delete). The
  preview re-validates the input itself (`schema.safeParse`) and returns a small human-readable
  summary or `null` — never throws. `preview` is optional on `CapabilityDefinition`, but a
  `requiresConfirmation: true` tool with no `preview` still gets a confirmation prompt
  (`server.ts`'s `createToolHandler` falls back to a generic "Confirm: `<title>`?" message) —
  omitting `preview` is not a way to skip confirmation, only `preview` explicitly returning
  `null` is. Always add a `preview` when there's meaningful context to show (the entity's
  name, not just its id).
- `guidance.dependencies` on tools that take an id should point at the list/detail tool that
  produces it, so a model resolves a real id instead of inventing one.
- A cross-domain tool (reads/writes more than one capability) must list **every** relevant
  scope — `tool-registry.ts` (`listToolsForScopes`) requires the caller to hold all of them.
- `resultCap` must be ≥ the largest array any output field can hold (see the DB gotcha above).

### 7. Optional: Muse keyword fallback

If this domain should also be reachable from the Muse chat surface (which can't reliably emit
a structured tool-router response), add a short keyword list to the `terms` array in
`inferMuseCapabilities` (`mcp/chat-tool-adapter.ts`):

```ts
['task', ['task', 'to-do', 'todo', 'checklist', 'reminder']],
```

Only add this when the domain is meant to be chat-reachable by casual phrasing; it's a
fallback for when phrasing doesn't match a domain term, not a required step for every tool.

### 8. Tests

Create `mcp/tools/<domain>-crud.test.ts` (or `<domain>.test.ts`), mirroring
`tasks-crud.test.ts` / `career-crud.test.ts`:

```ts
import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './tasks'; // triggers registerTool calls as a side effect
import { callTool, type McpToolResult } from '../tool-registry';

const userId = 'a4000001-0000-4000-8000-000000000001';
const otherUserId = 'a4000001-0000-4000-8000-000000000002';

function resultContent(result: McpToolResult) {
  return result.structuredContent as Record<string, unknown>;
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [id, `Test User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
});
```

Cover, per tool:

- The happy path (create → appears in list → detail round-trip).
- **Cross-user isolation** for every id-scoped read/write/delete — call it as `otherUserId`
  and assert the nullable/boolean not-found result (`{ task: null }`, `{ removed: false }`),
  never an error. This is the single most important thing to test; a missing `ownerUserId`
  filter is a real cross-tenant data leak, not a cosmetic bug.
- Validation edge cases the schema is meant to reject (e.g. an empty update payload, an
  invalid state transition).
- Anything the tool's own description promises (a filter, a bound like `resultCap`/`limit`).

Clean up rows you create (`db.deleteFrom(...)`) at the end of each test — these run against the
real test database, not mocks.

### 9. Validate

If you touched `packages/db/src/*` (repository changes), rebuild it first — `services/api`
resolves `@hominem/db/*` types from `packages/db/build/*.d.ts`, not live source:

```bash
cd packages/db && npx tsc -p tsconfig.json
```

Then from `services/api`:

```bash
pnpm exec vitest run src/mcp/tools/<domain>-crud.test.ts   # new tool coverage
pnpm exec vitest run src/mcp                               # full MCP surface, no regressions
pnpm typecheck
pnpm exec oxfmt <changed files> --write
```

Run the full completion gate before reporting the work done: `pnpm run check` and
`pnpm format:check` (see the `hominem-workflow` skill).

## Invariants to enforce in review

- `mcp/tools/<domain>.ts` contains only `registerTool` wiring — no query/business logic. That
  lives in `application/<domain>.service.ts` (shared with RPC if it exists — see
  `hominem-resource`).
- Every service function scopes its query by the caller's `ownerUserId`.
- Expected "not found" is a nullable/boolean return, never a thrown error, from any function a
  tool or its `preview` calls directly.
- `resultCap` is backed by a real `.limit(...)` in the underlying query, not just declared.
- Destructive tools declare `requiresConfirmation: true` and a `preview`.
- New scopes appear in `scopes.ts` (`MCP_SCOPES`) and are gated in `register-tools.ts`; a new
  capability appears (alphabetically) in `capability.ts`'s `CAPABILITIES`.
- Every id-scoped tool has a cross-user-isolation test, not just a happy-path test.

## Cross-cutting references

- Full resource pattern (MCP + RPC + web client): `hominem-resource` skill.
- Goose migrations + type regen for new tables/columns: `hominem-database` skill.
- Full completion gate: `pnpm run check` and `pnpm format:check` (see the `hominem-workflow` skill).
