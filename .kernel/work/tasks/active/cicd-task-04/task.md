---
id: cicd-task-04
type: task
title: Pin Railway CLI container to a versioned tag or digest
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: high
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Pin Railway CLI container to a versioned tag or digest

## summary
`railway-deploy-service.yml` runs jobs inside `container: ghcr.io/railwayapp/cli:latest`. The `:latest` tag is mutable — any upstream Railway CLI release can silently change the binary version on the next workflow run. This means deploys could start behaving differently with no code change on our side, and there is no audit trail of which CLI version performed a given deploy.

## context
```yaml
# Current (problematic)
jobs:
  deploy:
    runs-on: ubuntu-latest
    container: ghcr.io/railwayapp/cli:latest
```

This is a shared reusable workflow called by `deploy-api.yml`, `deploy-web.yml`, and `deploy-workers.yml`.

## acceptance criteria
- [ ] `container:` in `railway-deploy-service.yml` references a specific version tag or SHA digest, not `:latest`
- [ ] The pinned version is documented in a comment so engineers know where to update it
- [ ] Dependabot (cicd-task-07) is configured to keep this image updated automatically once pinned
- [ ] The three deploy workflows that call this reusable workflow continue to function unchanged

## steps
1. Look up the current Railway CLI releases at https://github.com/railwayapp/cli/releases or `ghcr.io/railwayapp/cli` tag list.
2. Identify the latest stable version tag (e.g. `v3.x.y`).
3. Pin via version tag (simpler, covered by Dependabot):
   ```yaml
   container: ghcr.io/railwayapp/cli:v3.22.0   # or current latest
   ```
   Or pin via digest (immutable, slightly harder to update):
   ```yaml
   container: ghcr.io/railwayapp/cli@sha256:<digest>
   ```
   Prefer the version tag approach since Dependabot can track it.
4. Add a comment above the `container:` line:
   ```yaml
   # Pin Railway CLI. Dependabot keeps this updated (.github/dependabot.yml).
   container: ghcr.io/railwayapp/cli:v3.22.0
   ```
5. Commit: `fix(ci): pin railway cli container to versioned tag`

## dependencies
- cicd-task-07 (Dependabot) should be done concurrently so Dependabot begins tracking the pinned version immediately

## journal
- 2026-05-15: Created from audit. :latest tag on a deployment container is a known reliability hazard.
