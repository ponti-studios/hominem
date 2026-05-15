---
id: cicd-task-07
type: task
title: Add Dependabot configuration
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Add Dependabot configuration

## summary
There is no `.github/dependabot.yml`. Without it, GitHub will not automatically open PRs for outdated GitHub Actions, npm packages, or the Go toolchain used for goose. Combined with a pinned Railway CLI container (cicd-task-04), an unpinned Docker base image (`node:24.14.1-alpine`), and the existing pnpm workspace, Dependabot should track at minimum: GitHub Actions, npm/pnpm packages, and Go modules.

## context
- No `.github/dependabot.yml` exists today
- Affected ecosystems:
  - `github-actions` — `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `actions/cache`, `actions/setup-go`, `taiki-e/install-action`
  - `npm` — root `package.json` and workspace packages
  - `gomod` — Go is used for goose but there is no `go.mod` in the repo (goose is installed via `go install`); skip gomod until a go.mod exists
  - Docker — `node:24.14.1-alpine` base image; Railway CLI image (once pinned in cicd-task-04)

## acceptance criteria
- [ ] `.github/dependabot.yml` exists
- [ ] GitHub Actions ecosystem is configured with weekly updates, targeting the `main` branch
- [ ] npm ecosystem is configured with weekly updates on the workspace root
- [ ] Docker ecosystem is configured for `apps/web/Dockerfile` and `services/api/Dockerfile`
- [ ] PRs are assigned to a reviewer or team (at minimum the `assignees` field is set)
- [ ] Each ecosystem has sensible `open-pull-requests-limit` to avoid PR flood (suggest 10 for npm, 5 for others)
- [ ] Commit prefix convention matches the repo style (e.g. `chore(deps):`)

## steps
1. Create `.github/dependabot.yml`:
   ```yaml
   version: 2
   updates:
     - package-ecosystem: github-actions
       directory: /
       schedule:
         interval: weekly
       open-pull-requests-limit: 5
       commit-message:
         prefix: "chore(deps)"

     - package-ecosystem: npm
       directory: /
       schedule:
         interval: weekly
       open-pull-requests-limit: 10
       commit-message:
         prefix: "chore(deps)"
       ignore:
         # Managed via overrides in package.json and pnpm-workspace.yaml
         - dependency-name: "react"
           update-types: ["version-update:semver-major"]

     - package-ecosystem: docker
       directory: /apps/web
       schedule:
         interval: weekly
       open-pull-requests-limit: 5
       commit-message:
         prefix: "chore(deps)"

     - package-ecosystem: docker
       directory: /services/api
       schedule:
         interval: weekly
       open-pull-requests-limit: 5
       commit-message:
         prefix: "chore(deps)"
   ```
2. After cicd-task-04 is complete, add a `docker` entry for `.github/workflows/` directory pointing to the Railway CLI image.
3. Commit: `chore(ci): add dependabot configuration`

## dependencies
- cicd-task-04 should be done before or concurrently so Dependabot immediately tracks the pinned Railway CLI version

## journal
- 2026-05-15: Created from audit. No Dependabot config found.
