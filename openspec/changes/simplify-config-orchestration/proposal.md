## Why

The repo currently spreads workflow orchestration across Just recipes, package scripts, Turbo filters, Playwright `webServer` command strings, and CI-only setup assumptions. That makes routine tasks harder to reason about, duplicates startup logic, and turns failures into multi-layer debugging instead of a single clear command surface.

## What Changes

- Consolidate repo-level developer workflows behind a smaller set of canonical Just recipes with clear ownership between root commands and package-local scripts.
- Move environment bootstrapping and startup orchestration out of embedded Playwright command strings into explicit commands that can be invoked the same way locally and in CI.
- Standardize local versus CI behavior for web E2E runs so migrations, service startup, and server reuse are deliberate inputs instead of hidden branching inside config files.
- Remove or rename duplicate task-runner entry points where they describe the same workflow with different wrappers.
- Document the resulting command model so common flows such as setup, check, API development, web development, and web E2E each have one primary entry point.

## Capabilities

### New Capabilities

- `developer-workflows`: Define a canonical repo-level command surface for common developer and CI workflows, including setup, checks, targeted package runs, and E2E entry points.
- `web-e2e-orchestration`: Define deterministic startup and execution rules for web Playwright runs so local and CI environments use explicit orchestration steps instead of inline config logic.

### Modified Capabilities

None.

## Impact

- Affected code: [justfile](/Users/charlesponti/Developer/hominem/justfile), [apps/web/playwright.config.ts](/Users/charlesponti/Developer/hominem/apps/web/playwright.config.ts), workspace and package scripts such as [package.json](/Users/charlesponti/Developer/hominem/package.json), [apps/web/package.json](/Users/charlesponti/Developer/hominem/apps/web/package.json), and [services/api/package.json](/Users/charlesponti/Developer/hominem/services/api/package.json).
- Affected systems: local developer workflow, CI task invocation, database/test environment setup, and Playwright web server startup.
- Dependencies: OpenSpec capability docs for the new command-surface and E2E orchestration contracts, plus follow-on updates to CI/docs that depend on renamed or removed commands.
