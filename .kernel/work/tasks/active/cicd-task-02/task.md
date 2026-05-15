---
id: cicd-task-02
type: task
title: Add .dockerignore for apps/web
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Add .dockerignore for apps/web

## summary
`services/api/` has a thorough `.dockerignore` that excludes test files, IDE config, CI config, source maps, and sensitive directories. `apps/web/` has no `.dockerignore` at all — it falls back to the root `.dockerignore`, which is minimal (only excludes `node_modules`, debug logs, Dockerfile, `.git`, `.gitignore`, `.npmrc`). This means the web Docker build context includes test files, coverage reports, editor config, storybook artifacts, and other noise that slows builds and slightly expands attack surface.

## context
- Root `.dockerignore`: 9 lines, very minimal
- `services/api/.dockerignore`: ~90 lines, comprehensive
- `apps/web/Dockerfile`: no sibling `.dockerignore`
- Docker resolves `.dockerignore` relative to the Dockerfile location; a file at `apps/web/.dockerignore` will be used when building with `-f apps/web/Dockerfile`

## acceptance criteria
- [ ] `apps/web/.dockerignore` exists and is adapted from the `services/api/.dockerignore` reference
- [ ] It excludes: `.git`, `.env*`, `node_modules`, `dist`, `build`, `.turbo`, `*.tsbuildinfo`, test files (`*.test.ts`, `*.spec.ts`, `coverage`), IDE files, CI files, source maps, sensitive dirs (`.auth`, `.claude`, `.codex`, `.cache`)
- [ ] It does NOT exclude files the web build actually needs: `app/`, `public/`, `vite.config.*`, `tailwind.config.*`, react-router config
- [ ] A fresh `docker build -f apps/web/Dockerfile .` completes successfully after the file is added

## steps
1. Create `apps/web/.dockerignore` modelled on `services/api/.dockerignore`.
   Key additions specific to the web app:
   - Keep `.next` exclusion (not used but harmless)
   - Add `.react-router` to excluded build artifacts
   - Add `storybook-static` if present
   - Do NOT exclude `vite.config.*` — needed at build time
2. Verify the file is placed at `apps/web/.dockerignore` (sibling to `apps/web/Dockerfile`).
3. Run `docker build -f apps/web/Dockerfile . --target builder` and confirm it succeeds.
4. Commit: `chore(docker): add .dockerignore for web app`

## dependencies
None — standalone file creation.

## journal
- 2026-05-15: Created from audit. The gap between `services/api/.dockerignore` (comprehensive) and `apps/web/` (none) was identified.
