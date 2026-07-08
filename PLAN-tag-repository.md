# Plan: Create TagRepository in packages/db

## Motivation

Tags (`app.tags` / `app.tagAssignments`) are a cross-domain concept, not finance-specific. The CRUD functions currently live in `packages/finance/src/categories.ts` (with "budget category" misnomers), forcing non-finance consumers to depend on `@hominem/finance-services` or inline their own queries. Moving them to `packages/db` follows the existing pattern (`NoteRepository`, `ChatRepository`) and makes tags available to any domain package.

## Current state

```
packages/finance/src/categories.ts
  ├── getAllTags                          ← tag CRUD (should move)
  ├── createTag                           ← tag CRUD (should move)
  ├── updateTag                           ← tag CRUD (should move)
  ├── deleteTag                           ← tag CRUD (should move)
  ├── getTagById                          ← tag CRUD (should move)
  ├── checkTagNameExists                  ← tag CRUD (should move)
  ├── getBudgetCategoriesWithSpending     ← finance-specific (stays)
  ├── getBudgetTrackingData               ← finance-specific (stays)
  ├── bulkCreateBudgetCategoriesFromTransactions  ← dead no-op (delete)
  └── Aliases: getSpendingCategories, getTransactionTags,
               getUserExpenseCategories, createBudgetCategory,
               updateBudgetCategory, deleteBudgetCategory,
               getBudgetCategoryById, checkBudgetCategoryNameExists
```

**External consumers:**

| Consumer | What it uses | Notes |
|---|---|---|
| `services/api/src/routes/finance/finance.tags.ts` | `getTransactionTags` from `@hominem/finance-services` | REST route |
| `services/api/src/rpc/routes/finance.tags.ts` | `db.selectFrom('app.tags')` inlined | RPC route — inlines own query |
| `packages/finance/src/data-ops.ts` | `getTransactionTags` | Re-exported alias |
| `packages/finance/src/finance.budget.integration.test.ts` | alias names | Test file |
| `packages/finance/src/finance.data-ops.integration.test.ts` | `createBudgetCategory` | Test file |

## Proposed structure

### New: `packages/db/src/services/tags/tags.repository.ts`

Exports a `TagsRepository` class (or bare functions — follow the pattern the team prefers; notes uses a class `NoteRepository`):

```ts
export class TagsRepository {
  constructor(private db: DbHandle)

  async getAll(ownerId: string): Promise<Selectable<AppTags>[]>
  async getById(id: string, ownerId: string): Promise<Selectable<AppTags> | null>
  async create(input: CreateTagInput): Promise<Selectable<AppTags>>
  async update(id: string, ownerId: string, input: Partial<Selectable<AppTags>>): Promise<Selectable<AppTags> | null>
  async delete(id: string, ownerId: string): Promise<boolean>
  async checkNameExists(ownerId: string, name: string): Promise<boolean>
}
```

Uses the `db` singleton directly (like `NoteRepository` does), but also accepts a `DbHandle` for transactional use.

### Changed: `packages/db/src/index.ts`

Add new export:

```ts
export { TagsRepository } from './services/tags/tags.repository';
```

### Changed: `packages/finance/src/categories.ts`

- Remove the 6 CRUD function implementations
- Import `TagsRepository` from `@hominem/db` and delegate
- Keep alias exports pointing to repository methods
- Keep `getBudgetCategoriesWithSpending` and `getBudgetTrackingData`
- Delete `bulkCreateBudgetCategoriesFromTransactions` (dead no-op)

### Changed: `services/api/src/rpc/routes/finance.tags.ts`

Should use `TagsRepository` instead of inlining the `db.selectFrom(...)` query. This eliminates the duplicate query logic.

### Consumers updated automatically

Because the alias names (`getTransactionTags`, `createBudgetCategory`, etc.) remain in `categories.ts` as delegates to the repository, all existing imports from `@hominem/finance-services` continue to work without changes. Over time, consumers can switch to importing `TagsRepository` directly from `@hominem/db`.

## Migration path

### Phase 1 — Create repository (no breaking changes)

1. Create `packages/db/src/services/tags/tags.repository.ts` with all 6 CRUD methods
2. Export from `packages/db/src/index.ts`
3. Rewrite `packages/finance/src/categories.ts` to delegate to `TagsRepository`
4. Typecheck passes, all 18 tests pass
5. `bulkCreateBudgetCategoriesFromTransactions` is deleted (it's a no-op returning `[]`)

### Phase 2 — Migrate RPC route (optional, low risk)

Update `services/api/src/rpc/routes/finance.tags.ts` to use `TagsRepository` instead of inlined query.

### Phase 3 — Deprecate aliases (future)

Mark the `Budget`- and `Category`-named aliases as `@deprecated` so new code imports from the repository directly.

## Files touched

| File | Action |
|---|---|
| `packages/db/src/services/tags/tags.repository.ts` | CREATE |
| `packages/db/src/index.ts` | EDIT — add TagsRepository export |
| `packages/finance/src/categories.ts` | EDIT — delegate to TagsRepository, remove CRUD impls, delete dead no-op |
| `packages/finance/src/index.ts` | EDIT — remove `bulkCreateBudgetCategoriesFromTransactions` from re-export if present |
| `services/api/src/rpc/routes/finance.tags.ts` | EDIT (Phase 2) — use TagsRepository |

## Risk

- **None.** All alias names are preserved. All existing imports continue to resolve. The repository is a pure extraction — no logic changes.
- The `categories.ts` file becomes thinner, which is the goal.
