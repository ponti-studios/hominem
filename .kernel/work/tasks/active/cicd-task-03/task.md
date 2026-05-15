---
id: cicd-task-03
type: task
title: Fix deploy-mobile to use composite action and frozen-lockfile
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: high
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Fix deploy-mobile to use composite action and frozen-lockfile

## summary
`deploy-mobile.yml` manually sets up pnpm and Node inline instead of using `.github/actions/setup-pnpm-workspace`, and runs `pnpm install` without `--frozen-lockfile`. It also installs `eas-cli` via `npm install -g` (unfrozen, global npm install) rather than managing it as a workspace dependency or caching it. This is the one workflow that bypasses all the hardening applied to the composite action.

## context
```yaml
# Current (problematic) deploy-mobile.yml excerpt
- name: setup-pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 11.1.1

- name: setup-node-js
  uses: actions/setup-node@v4
  with:
    node-version: 24.14.1   # hardcoded, not a matrix var

- name: install-dependencies
  run: pnpm install          # no --frozen-lockfile

- name: setup-eas
  run: npm install -g eas-cli  # unfrozen global install
```

Issues:
1. Does not use the composite action → no pnpm store cache wired up
2. `pnpm install` without `--frozen-lockfile` can silently resolve a different dependency graph
3. Node version is hardcoded (fine for now but creates a second source of truth)
4. `npm install -g eas-cli` is not pinned to a version and uses npm, not pnpm

## acceptance criteria
- [ ] `deploy-mobile.yml` replaces the manual pnpm/node setup steps with `uses: ./.github/actions/setup-pnpm-workspace`
- [ ] The composite action call passes `node-version: 24.14.1` as input
- [ ] `pnpm install` is replaced by the composite action's default (`--frozen-lockfile`)
- [ ] `eas-cli` installation is pinned to a specific version (e.g. `npm install -g eas-cli@<latest-stable>`) or better, added as a `devDependency` in `apps/mobile/package.json` so it installs with the workspace
- [ ] The workflow still triggers correctly on `workflow_run: [validate-mobile]` and `workflow_dispatch`
- [ ] A `timeout-minutes: 60` is added to the `build-production` job (EAS builds can be slow)

## steps
1. Open `.github/workflows/deploy-mobile.yml`.
2. Remove the `setup-pnpm`, `setup-node-js`, and `install-dependencies` steps.
3. Add in their place:
   ```yaml
   - name: setup-pnpm-workspace
     uses: ./.github/actions/setup-pnpm-workspace
     with:
       node-version: 24.14.1
   ```
4. Change `run: npm install -g eas-cli` to pin a version:
   ```yaml
   - name: setup-eas
     run: npm install -g eas-cli@14   # pin to current major
   ```
   Or (preferred) add `eas-cli` to `apps/mobile/package.json` devDependencies and reference via `pnpm exec eas`.
5. Add `timeout-minutes: 60` to the `build-production` job.
6. Test with `workflow_dispatch` on a non-main branch to confirm the job passes up to the `eas build` step.
7. Commit: `fix(ci): use composite action + frozen-lockfile in deploy-mobile`

## dependencies
- Composite action must be working (it is — this is already confirmed)

## journal
- 2026-05-15: Created from audit. deploy-mobile is the only deploy workflow that bypasses the composite action and omits --frozen-lockfile.
