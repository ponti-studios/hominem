---
id: cicd-task-09
type: task
title: Add release workflow and worker health check
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: low
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Add release workflow and worker health check

## summary
Two missing pieces from the pipeline: (1) there is no release workflow to create GitHub releases, tag versions, or generate changelogs — deploys happen but there is no versioned audit trail; (2) `services/api/worker/railway.json` has no `healthcheckPath`, whereas the API and web railway configs do. The worker uses `restartPolicyType: ALWAYS` which is correct for a background worker, but Railway cannot confirm health after deploys without a health endpoint.

## context
### Release workflow
- No `.github/workflows/release.yml` exists
- The repo uses calendar or semver versioning (unclear — no CHANGELOG.md or release tags visible)
- Suggested approach: use `release-please` (Google) or a simple tag-on-merge workflow
- The `package.json` has `version: 1.0.0` but this is never bumped

### Worker health check
- `services/api/worker/railway.json`:
  ```json
  "deploy": {
    "startCommand": "pnpm --filter @hominem/api run start:worker",
    "restartPolicyType": "ALWAYS",
    "restartPolicyMaxRetries": 10,
    ...
  }
  ```
- No `healthcheckPath` or `healthcheckTimeout` — Railway cannot verify the worker started successfully
- The worker script is at `services/api/src/worker.ts`. If it exposes a minimal HTTP health endpoint, Railway can probe it.

## acceptance criteria
### Release workflow
- [ ] `.github/workflows/release.yml` exists
- [ ] It triggers on push to `main` (after all validate workflows pass, or via `workflow_run`)
- [ ] It creates a GitHub Release with an auto-generated changelog from commit messages
- [ ] It tags the release with the version from `package.json` or a date-based scheme

### Worker health check
- [ ] `services/api/src/worker.ts` exposes a minimal HTTP server on `PORT` (or a fixed port) that responds 200 to `GET /health`
- [ ] `services/api/worker/railway.json` adds:
  ```json
  "healthcheckPath": "/health",
  "healthcheckTimeout": 60
  ```
- [ ] The worker still processes BullMQ jobs as before — the HTTP server is non-blocking

## steps
### Release workflow
1. Create `.github/workflows/release.yml` using `googleapis/release-please-action`:
   ```yaml
   name: release

   on:
     push:
       branches: [main]

   permissions:
     contents: write
     pull-requests: write

   jobs:
     release-please:
       runs-on: ubuntu-latest
       timeout-minutes: 10
       steps:
         - uses: googleapis/release-please-action@v4
           with:
             release-type: node
             token: ${{ secrets.GITHUB_TOKEN }}
   ```
2. Add a `release-please-config.json` and `.release-please-manifest.json` at the repo root if using monorepo mode.
3. Alternatively, use a simpler tag-on-push approach if release-please feels too heavy.

### Worker health check
1. In `services/api/src/worker.ts`, add a minimal HTTP server alongside the BullMQ worker:
   ```typescript
   import { createServer } from 'node:http'
   const healthServer = createServer((req, res) => {
     if (req.url === '/health' && req.method === 'GET') {
       res.writeHead(200)
       res.end('ok')
     } else {
       res.writeHead(404)
       res.end()
     }
   })
   healthServer.listen(process.env.PORT ?? 3001)
   ```
2. Update `services/api/worker/railway.json`:
   ```json
   "healthcheckPath": "/health",
   "healthcheckTimeout": 60
   ```
3. Verify the worker deploys and Railway shows a green health check in the Railway dashboard.

## dependencies
- Worker health check change requires a code change to `services/api/src/worker.ts` — coordinate with anyone actively working on the worker
- Release workflow has no code dependencies

## journal
- 2026-05-15: Created from audit. Both items are "missing" rather than "broken" — low priority but improve operational visibility.
