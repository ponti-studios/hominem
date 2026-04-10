# Simplify Config Orchestration

## Problem

The repository's developer workflows were scattered across four incompatible orchestration layers: Just recipes at the root, package scripts within workspace packages, Turbo filters invoked by those scripts, and tool-specific commands embedded as strings inside configuration files like Playwright's `webServer.command`. This fragmentation made routine tasks harder to reason about, duplicated startup logic across multiple files, and turned failures into multi-layer debugging chains where it was unclear which tool owned the responsibility.

The immediate pain surface was web E2E execution: database setup, API startup mode, web build and serve steps, and the distinction between local versus CI behavior were split between the Justfile, `apps/web/package.json`, and `apps/web/playwright.config.ts`. Developers couldn't run the E2E startup path outside Playwright for debugging, and CI had to embed conditional logic inside configuration files rather than making environment differences explicit.

## Exploration

The team considered several approaches to consolidation. One option was moving all orchestration into the root `package.json` scripts, providing a single command surface at the cost of treating package.json as a task runner in addition to its dependency declaration role. Another approach was keeping both Just and duplicate package-level wrappers for convenience, accepting that multiple entry points would create drift over time. A third option involved flattening all package scripts into root-level commands, which would reduce the monorepo to a single command surface but would eliminate package-local leaf commands and make it harder to understand what each package contributes.

The team also debated whether to keep branching inside `playwright.config.ts` by making it conditional on environment variables, or to externalize environment preparation, server startup, and test execution as separate explicit commands. The former preserved the simplicity of a single E2E command at the cost of opaque conditionals; the latter made assumptions explicit but required callers to orchestrate three steps instead of one.

## Solution

The team chose the root Justfile as the orchestration boundary for cross-package workflows. This kept orchestration centralized in one place instead of splitting it across `package.json` aliases and config-file command strings. The repository already used Just for composite tasks and infrastructure helpers, making it a natural fit for broader workflow orchestration.

Package-local `package.json` scripts remained as leaf commands describing what each package does locally: `build`, `dev`, `start`, `test`, and focused test variants. Root recipes could call Turbo or package scripts underneath, but external callers (developers and CI) would reference the root recipe as the canonical entry point.

Web E2E execution was split into three explicit phases: environment preparation (database migrations, dependency setup), long-running service startup (API server, web dev server), and test execution (Playwright run). Playwright would depend only on the startup phase it actually needed, rather than encoding setup assumptions in `webServer.command`.

This allowed the startup path to be debuggable outside Playwright—developers could run the preparation and server startup commands locally to verify them before running tests. CI and local environments could use explicit orchestration steps rather than branching inside configuration files, making their different prerequisites visible and controllable.

Command migrations treated the final command model as a breaking change that required updating consumers immediately. Rather than leaving deprecated aliases indefinitely, the team updated CI workflows, documentation, and all config references in the same change. This prevented the command surface from accumulating dead entry points that would undermine the simplification goal.

## Learnings

Workflow orchestration sprawls across tools when there's no clear ownership boundary. The repository had Just for infra, `package.json` for package operations, Turbo for dependency-aware execution, and tool-specific shell commands for application-level startup. Without a deliberate rule about which layer owned which responsibility, each new workflow got added to the most convenient location rather than the correct one.

Hiding environment differences inside configuration conditionals makes debugging harder. When local and CI behavior differ (which they should—CI has different preconditions), embedding that branching in JavaScript string assembly or shell command construction means developers can't run the CI path locally without modifying the config. Externalizing those differences as explicit commands makes them inspectable and testable independently.

Command renames are breaking changes that must be addressed immediately. The team learned from the repository's accumulated stale command references that leaving deprecated aliases "for backward compatibility" actually increases complexity by preserving ambiguity. A single clear command model is more valuable than a gradual transition with multiple entry points.

Splitting monolithic orchestration into phases (preparation, startup, execution) improves debuggability without sacrificing convenience. A developer can run each phase independently to understand which one is failing, while CI can still invoke all three in sequence with a single root command.

Package-local scripts should describe package-specific operations, not be aliases to root commands. When every package script was a thin wrapper around Turbo, it created false optionality—developers could run the same workflow from different places with different semantics. Keeping leaf scripts small and package-specific makes the monorepo's structure clearer.
