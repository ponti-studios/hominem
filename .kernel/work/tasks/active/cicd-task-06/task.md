---
id: cicd-task-06
type: task
title: Add dependency audit workflow
status: todo
created_at: 2026-05-15
updated_at: 2026-05-15
goal: .kernel/work/goals/cicd-goal-01/goal.md
priority: high
linked_knowledge:
  - .kernel/knowledge/notes/cicd-note-01/note.md
---

# Add dependency audit workflow

## summary
There is no workflow that runs `pnpm audit` or equivalent. Known CVEs in transitive dependencies can accumulate unnoticed between Dependabot PRs. A dedicated audit job catches high/critical vulnerabilities on every push to main and on every pull request, providing a clear gate before code merges.

## context
- `pnpm audit` is the standard command; it exits non-zero on any vulnerability at or above the specified severity level
- `pnpm audit --audit-level=high` fails on high and critical but passes on moderate/low
- The workspace already has `pnpm-workspace.yaml` with `minimumReleaseAge: 1440` and `minimumReleaseAgeStrict: true` — good hygiene, but does not catch already-installed vulns
- No existing workflow references `pnpm audit`

## acceptance criteria
- [ ] `.github/workflows/audit-deps.yml` exists and runs on `push: branches: [main]` and `pull_request`
- [ ] It runs `pnpm audit --audit-level=high` and fails the workflow if exit code is non-zero
- [ ] It uses the composite action for setup so pnpm store is cached
- [ ] It has `permissions: contents: read`
- [ ] It has `timeout-minutes: 15`
- [ ] It has a concurrency group to avoid redundant runs
- [ ] On audit failure the output clearly shows which package has the vulnerability

## steps
1. Create `.github/workflows/audit-deps.yml`:
   ```yaml
   name: audit-deps

   on:
     push:
       branches: [main]
     pull_request:

   permissions:
     contents: read

   concurrency:
     group: audit-deps-${{ github.head_ref || github.ref }}
     cancel-in-progress: true

   jobs:
     audit:
       runs-on: ubuntu-latest
       timeout-minutes: 15

       steps:
         - name: checkout-repository
           uses: actions/checkout@v4

         - name: setup-pnpm-workspace
           uses: ./.github/actions/setup-pnpm-workspace
           with:
             node-version: '24.14.1'

         - name: audit-dependencies
           run: pnpm audit --audit-level=high
   ```
2. If the first run surfaces existing vulnerabilities in the workspace, decide whether to:
   a. Fix them before merging the workflow (preferred)
   b. Add a `.auditrc` or `pnpm audit --ignore-registry-data` workaround and open tracking issues for known false positives
3. Commit: `feat(ci): add dependency audit workflow`

## dependencies
- None — can be created independently

## journal
- 2026-05-15: Created from audit. No vulnerability scanning workflow existed.
