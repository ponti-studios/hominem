## 1. Canonicalize the repo command surface

- [x] 1.1 Audit the current public Just recipes, package scripts, and config-referenced commands to identify duplicate workflow entry points and stale consumers.
- [x] 1.2 Add canonical root-level Just recipes for the common repo workflows that need orchestration, including setup, checks, development, build, and web E2E.
- [x] 1.3 Remove, rename, or explicitly demote duplicate workflow wrappers once the canonical command names exist.

## 2. Refactor web E2E orchestration

- [x] 2.1 Split web E2E preparation, API startup, web startup, and test execution into explicit commands with clear local versus CI behavior.
- [x] 2.2 Update [apps/web/playwright.config.ts](/Users/charlesponti/Developer/hominem/apps/web/playwright.config.ts) to call the explicit startup commands or minimal wrappers instead of embedding multi-step shell orchestration.
- [x] 2.3 Ensure the CI startup path reuses externally provided setup while the local path remains self-contained and directly runnable for debugging.

## 3. Migrate consumers and validate behavior

- [x] 3.1 Update CI workflows, docs, and config references to use the canonical workflow commands introduced by this change.
- [x] 3.2 Validate the refactored web E2E startup path by running the explicit preparation and startup commands outside Playwright and then through the Playwright entry point.
- [x] 3.3 Confirm that startup failures remain attributable to orchestration commands and that post-startup Playwright failures still surface as application regressions.
