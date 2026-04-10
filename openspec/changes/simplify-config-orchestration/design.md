## Context

The repo currently uses four orchestration layers for the same developer workflows: root Just recipes, workspace/package scripts, Turbo filters, and tool-specific shell commands embedded inside configuration files such as Playwright. The immediate pain point is web E2E execution, where database setup, API startup mode, web build/start steps, and local versus CI branching are split between [justfile](/Users/charlesponti/Developer/hominem/justfile), [apps/web/package.json](/Users/charlesponti/Developer/hominem/apps/web/package.json), and [apps/web/playwright.config.ts](/Users/charlesponti/Developer/hominem/apps/web/playwright.config.ts). Similar duplication exists in the broader command surface, where several commands are thin wrappers around the same Turbo invocation or package script.

The proposal aims to reduce operational complexity without changing product behavior. The design therefore treats command naming and orchestration boundaries as the primary change, not the underlying build tools.

## Goals / Non-Goals

**Goals:**

- Establish one canonical repo-level entry point for each common workflow category: setup, checks, development, build, and web E2E.
- Keep package scripts as small leaf commands that describe package-local actions, while moving cross-package orchestration to the root Justfile.
- Replace embedded Playwright shell orchestration with explicit commands whose local and CI behavior is intentional and inspectable.
- Make web E2E startup deterministic by separating environment preparation from server startup and test execution.
- Update docs and workflow consumers in the same change so renamed or removed commands do not drift.

**Non-Goals:**

- Replacing Bun, Turbo, Just, Playwright, or Docker Compose with different tooling.
- Redesigning the entire CI pipeline beyond the workflows touched by command renames or E2E orchestration cleanup.
- Changing application behavior unrelated to orchestration, such as the underlying note creation flow.
- Flattening every package script in the monorepo into root-level commands.

## Decisions

### Decision: Use the root Justfile as the orchestration boundary

Cross-package workflows will be expressed as root Just recipes. Package `package.json` scripts remain package-local leaf commands such as `build`, `dev`, `start`, `test`, and focused test variants. Root recipes may call Turbo or package scripts, but external callers should prefer the root recipe for repo workflows.

Rationale:

- The repo already has a Justfile and uses it for infra and composite commands.
- This keeps orchestration in one place instead of splitting it across `package.json` aliases and config-file command strings.
- It matches the repo rule of one canonical command per workflow.

Alternatives considered:

- Move all orchestration into root `package.json` scripts. Rejected because the repo already standardizes on Just for composite tasks and infra helpers.
- Keep both Just and duplicate package-level wrappers. Rejected because duplicate entry points are the current source of drift.

### Decision: Make environment mode explicit for web E2E orchestration

Web E2E runs will use explicit orchestration commands for preparation and startup rather than baking local-versus-CI logic into Playwright `webServer.command` strings. The config should reference stable commands or minimal wrappers whose responsibilities are narrow and obvious.

Rationale:

- Debugging is easier when the startup path can be run directly outside Playwright.
- CI and local environments have different prerequisites; hiding those differences inside JavaScript string assembly is brittle.
- This preserves deterministic behavior while reducing config complexity.

Alternatives considered:

- Keep branching inside `playwright.config.ts`. Rejected because it obscures responsibility and makes failures harder to reproduce.
- Make CI and local use the exact same full bootstrap sequence. Rejected because CI already performs some setup externally and should not rerun all preparation work.

### Decision: Split web E2E into preparation, server startup, and test execution phases

The repo will define separate commands for environment preparation, long-running service startup, and test execution. Playwright should depend only on the startup phase it actually needs.

Rationale:

- This reduces the amount of hidden work done during test startup.
- Preparation becomes reusable for local debugging and CI jobs.
- Server reuse semantics become clearer because startup commands no longer also mutate the environment.

Alternatives considered:

- Preserve the single all-in-one web E2E behavior. Rejected because it couples installation, bootstrapping, server launch, and test execution into one opaque lane.

### Decision: Treat command migrations as a compatibility change that must update consumers immediately

Any renamed or removed command must be updated in CI workflows, docs, and config references within the same implementation.

Rationale:

- This repo has already accumulated stale command references when wrappers drift from their consumers.
- A simplification change that leaves duplicate or dead references behind would increase, not reduce, complexity.

Alternatives considered:

- Leave deprecated aliases indefinitely. Rejected because it preserves ambiguity and makes the final command model harder to learn.

## Risks / Trade-offs

- Root command ownership becomes more centralized -> Mitigation: keep recipes small, name them by workflow outcome, and continue using package-local leaf scripts underneath.
- Command renames can break CI or local habits during migration -> Mitigation: update workflows and docs in the same change, and keep temporary aliases only where an in-flight migration requires them.
- Splitting E2E preparation from execution may expose missing assumptions in local setup -> Mitigation: codify those assumptions as explicit preparation steps and validate them with the existing web auth and assistant lifecycle suites.
- Deterministic startup can still fail if application behavior is broken -> Mitigation: treat orchestration cleanup and functional test failures as separate debugging lanes so startup simplification does not mask product regressions.

## Migration Plan

1. Introduce the new canonical Just recipes and any small supporting leaf scripts they require.
2. Repoint Playwright web server startup and CI invocations to the new commands.
3. Update docs and workflow references to the canonical command names.
4. Remove obsolete aliases and embedded orchestration once consumers are migrated.

## Open Questions

- Whether the final E2E command surface should expose separate public commands for local and CI, or a single command with an explicit mode argument.
- Whether any existing Just recipes outside web E2E should be folded into the same simplification pass or deferred to a follow-up change.
