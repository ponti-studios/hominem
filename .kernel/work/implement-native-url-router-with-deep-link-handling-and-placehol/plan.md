# Implementation Plan

## Goal

Implement native URL router with deep-link handling and placeholder route shells

## Approach

Start at the app boundary: define a single route model, build the root shell around it, then add adapters for deep links and native intents. Placeholder screens come last, once the route set and fallback rules are stable.

The key decision is to make all launch entry paths converge into one router so later auth and protected-shell logic can extend the same structure instead of replacing it.

## Key Decisions

| Decision             | Choice                                                                | Rationale                                                                          | Alternative Considered                                                               |
| -------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Route model          | One shared route model for app launch, deep links, and native intents | Prevents divergent entry semantics before Phase 2                                  | Separate handlers per entry type, rejected because it would duplicate behavior       |
| Placeholder strategy | Minimal route shells for every major destination                      | Gives later phases stable structure without prematurely implementing product logic | Skipping placeholders, rejected because later phases would have to reshape the shell |

## Implementation Steps

### 1. Clarify scope and success criteria

- Read brief.md and confirm every success criterion is specific and testable
- Identify any ambiguities or missing information and resolve them before writing code
- Confirm all dependencies from brief.md are in place
- If scope is unclear, update brief.md before proceeding

### 2. Implement the core path

- Define the route model and destination map for the major public, protected, error, and fallback surfaces
- Build the root app container and placeholder screens around that route model
- Add deep-link parsing for supported URL schemes and domains
- Add native-intent handoff that normalizes into the same route model
- Verify fallback behavior for unknown or malformed routes

### 3. Verify behavior with tests

- Unit tests for route parsing and destination resolution, including malformed URLs and unsupported paths
- Integration tests for launch entry, deep-link entry, and native-intent entry converging into the same route model
- Manual verification on device for `hakumi://` and `https://hakumi.app/` paths plus unknown-route fallback

### 4. Capture follow-up work

- Record any route families that need richer placeholder semantics before Phase 2 starts
- Capture any deep-link contract ambiguities that must be resolved with backend or product owners
- Note any navigation behavior that should become explicit acceptance criteria for Phase 2 protected-shell work

## Risks

| Risk                                                               | Likelihood | Impact | Mitigation                                                                                                          |
| ------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Route mapping misses a top-level surface from the parity inventory | Med        | High   | Reconcile the route set against the parity matrix before closing the work item                                      |
| Native-intent entry semantics diverge from deep-link semantics     | Med        | High   | Normalize native-intent input into the same route model and verify both paths with identical destination assertions |

## Validation

How to verify this work is correct:

- **Automated:** route-parser and router integration tests for launch, deep-link, and native-intent entry paths
- **Manual:** launch the native app, open supported `hakumi://` and `https://hakumi.app/` URLs, and confirm placeholder destinations and fallback screens on device
- **Regression:** variant launch behavior and placeholder navigation must remain stable while observability is added afterward

## Rollback

Revert the root shell and router changes to the previous placeholder-only launch state, disable native deep-link handling temporarily, and keep Expo as the only functional route reference until the route model is corrected.
