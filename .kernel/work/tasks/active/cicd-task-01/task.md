---
id: cicd-task-01
type: task
title: Fix pnpm version drift in both Dockerfiles
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: high
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Fix pnpm version drift in both Dockerfiles

## summary
Both `apps/web/Dockerfile` and `services/api/Dockerfile` install pnpm via `npm install -g pnpm@10.33.0`. The workspace `packageManager` field in `package.json` declares `pnpm@11.1.1` and `pnpm-workspace.yaml` sets `engineStrict: true`. This means the Docker builder is using a different pnpm major version than the lockfile was generated with, risking install failures or silent behavioural differences.

## context
- `package.json`: `"packageManager": "pnpm@11.1.1"`
- `apps/web/Dockerfile` line 22: `npm install -g pnpm@10.33.0`
- `apps/web/Dockerfile` line 36: `npm install -g pnpm@10.33.0` (again in server stage)
- `services/api/Dockerfile` line 19: `npm install -g pnpm@10.33.0`
- `services/api/Dockerfile` line 34: `npm install -g pnpm@10.33.0` (again in release stage)
- Context: pnpm 11 was pinned everywhere in CI workflows and the composite action; the Dockerfiles were missed.

## acceptance criteria
- [ ] `apps/web/Dockerfile` builder stage installs `pnpm@11.1.1` in both the builder and server stages
- [ ] `services/api/Dockerfile` installs `pnpm@11.1.1` in both the builder and release stages
- [ ] No occurrence of `pnpm@10` remains in any Dockerfile
- [ ] Docker builds succeed locally with `docker build` from the repo root using the respective Dockerfiles

## steps
1. Open `apps/web/Dockerfile`.
   - Line 22: change `npm install -g pnpm@10.33.0` to `npm install -g pnpm@11.1.1`
   - Line 36: change `npm install -g pnpm@10.33.0` to `npm install -g pnpm@11.1.1`
2. Open `services/api/Dockerfile`.
   - Line 19: change `npm install -g pnpm@10.33.0` to `npm install -g pnpm@11.1.1`
   - Line 34: change `npm install -g pnpm@10.33.0` to `npm install -g pnpm@11.1.1`
3. Run a local Docker build smoke test for each:
   ```
   docker build -f apps/web/Dockerfile . --target builder --no-cache
   docker build -f services/api/Dockerfile . --target builder --no-cache
   ```
4. Confirm `pnpm --version` inside the image returns `11.1.1`.
5. Commit with message: `fix(docker): pin pnpm to 11.1.1 in all Dockerfile stages`

## dependencies
None — this is a standalone string substitution.

## journal
- 2026-05-15: Created from audit finding. Four occurrences of pnpm@10.33.0 across two Dockerfiles.
