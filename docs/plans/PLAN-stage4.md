# Stage 4: Audit Remaining Pre-existing "Typecheck" Errors

**Kills 0 test failures but unblocks full `pnpm typecheck` passing**

These are the 242 pre-existing typecheck errors noted in the project
context. They don't affect the running app (tsx runs without emitting)
but make it impossible to run a clean `pnpm typecheck` across the repo.

## Buckets

1. **Better-auth API signature mismatches** in `services/api/src/routes/auth.ts`
   — The auth routes file is 1300+ lines with deep better-auth bindings.
   Some better-auth API methods may have changed signatures between
   versions (better-auth is `^1.6.11`).

2. **InsertObject / Generated<> conflicts** in `packages/db/src/services/`
   (`chat.repository.ts`, `note.repository.ts`, `task.repository.ts`).
   Kysely's `Generated<>` wrapper on auto-increment columns causes type
   mismatches when passing explicit IDs in insert statements.

3. **env.ts validation in career app** — Fixed in earlier session
   (the `DATABASE_URL` env issue), but there may be residual type errors.

## Approach

Do NOT fix these unless time permits or they block Stage 5. The running
app (tsx) ignores type errors. Focus on the test failures in Stages 1-3.

If Stage 3 reveals the runway issue is caused by the version mismatch,
then fixing it becomes Stage 3's job and this stage is just a cleanup.
