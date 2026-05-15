---
id: cicd-task-08
type: task
title: Wire Turbo remote cache for CI runs
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: medium
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Wire Turbo remote cache for CI runs

## summary
`turbo.json` is fully configured with tasks, inputs, and outputs, but CI workflows do not set `TURBO_TOKEN` or `TURBO_TEAM`. Without remote cache, every CI run rebuilds all packages from scratch even when the only change was in one leaf package. Enabling the Turbo remote cache (Vercel or self-hosted) eliminates redundant rebuilds across `validate-api`, `validate-web`, `validate-db`, and `validate-mobile` runs.

## context
- `turbo.json` sets `"concurrency": "8"` and defines `build`, `lint`, `typecheck`, `test` with proper `dependsOn` and `inputs`
- The root `package.json` `scripts.check` calls `pnpm dlx turbo run ...` — dlx does not cache; but CI uses `just` which calls `pnpm exec turbo`
- `TURBO_TELEMETRY_DISABLED=1` is already set in both Dockerfiles — consistent stance on telemetry
- Two remote cache options:
  1. Vercel Remote Cache — free for hobby, requires `TURBO_TOKEN` (Vercel API token) and `TURBO_TEAM` (Vercel team slug)
  2. Self-hosted via `turbo-remote-cache` package or Turborepo's built-in support for custom endpoints
- The `validate-*` workflows all call just targets that invoke `pnpm exec turbo`

## acceptance criteria
- [ ] `TURBO_TOKEN` and `TURBO_TEAM` (or equivalent self-hosted env vars) are added as GitHub Actions secrets
- [ ] All four `validate-*.yml` workflows pass `TURBO_TOKEN` and `TURBO_TEAM` as environment variables in the relevant job or step
- [ ] A second consecutive CI run on the same commit shows cache hits in the Turbo output (`cache hit, replaying output`)
- [ ] Cache hits are also visible in Railway Docker builds if `TURBO_TOKEN` is passed as a build arg (optional stretch goal)
- [ ] `TURBO_TELEMETRY_DISABLED=1` remains set in CI to match the Docker image stance

## steps
1. Choose remote cache provider:
   - If using Vercel: go to vercel.com → Settings → Tokens → create a "turbo-ci" token.
   - Note the team slug from the Vercel dashboard URL.
2. Add secrets to the GitHub repository:
   - `TURBO_TOKEN` = Vercel API token (or self-hosted equivalent)
   - `TURBO_TEAM` = Vercel team slug prefixed with `team_` (e.g. `team_hominem`)
3. Update each `validate-*.yml` workflow job to expose the secrets:
   ```yaml
   env:
     TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
     TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
     TURBO_TELEMETRY_DISABLED: '1'
   ```
   Place this at the job level (not step level) so all `just` calls inherit it.
4. Alternatively, pass the env vars in the composite action so all callers get them automatically. Add to `setup-pnpm-workspace/action.yml` as optional inputs with empty defaults, then expose via `$GITHUB_ENV`.
5. Push a test branch and trigger two back-to-back runs of the same workflow. Confirm the second run shows `>>> FULL TURBO` or per-task `cache hit`.
6. Commit: `feat(ci): enable turbo remote cache for validate workflows`

## dependencies
- Requires a Vercel account or self-hosted cache infrastructure
- GitHub secrets must be created by a repo admin before the workflow change has any effect

## journal
- 2026-05-15: Created from audit. turbo.json is ready but no TURBO_TOKEN/TURBO_TEAM set in any workflow. Rebuild time on cache miss is the current default everywhere.
