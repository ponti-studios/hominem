# Implementation Plan

## Goal

Wire PostHog analytics, startup instrumentation, and crash reporting

## Approach

Instrument the app shell after the router is stable. Start by mapping the Expo lifecycle baseline into native launch and background events, then add cold-start measurement, then wire crash reporting and per-variant release metadata.

The key decision is to keep the first telemetry slice narrow and dependable: lifecycle, startup, and crashes only. Product-feature analytics can layer on later without destabilizing the baseline.

## Key Decisions

| Decision        | Choice                                                 | Rationale                                                                | Alternative Considered                                                                             |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Telemetry scope | Lifecycle, startup, and crash baseline only            | Establishes a trustworthy baseline before feature-level analytics expand | Instrumenting every placeholder screen now, rejected because it would create noisy pre-parity data |
| Variant tagging | Explicit per-variant release and analytics identifiers | Prevents preview/e2e/dev traffic from polluting production comparisons   | Shared config across variants, rejected because it hides rollout differences                       |

## Implementation Steps

### 1. Clarify scope and success criteria

- Read brief.md and confirm every success criterion is specific and testable
- Identify any ambiguities or missing information and resolve them before writing code
- Confirm all dependencies from brief.md are in place
- If scope is unclear, update brief.md before proceeding

### 2. Implement the core path

- Map native app lifecycle callbacks into the agreed PostHog event taxonomy
- Add cold-start measurement around launch and first interactive shell readiness
- Configure crash reporting and release metadata per variant
- Validate environment plumbing so analytics and crash-reporting credentials resolve correctly in each variant

### 3. Verify behavior with tests

- Unit tests for event tagging, environment selection, and startup metric capture helpers
- Integration checks that lifecycle transitions emit expected analytics payloads in the native shell
- Manual verification of analytics events, startup timing, and a safe test crash in each required variant

### 4. Capture follow-up work

- Record any event taxonomy mismatches that need explicit migration decisions before Phase 2 or Phase 6
- Note any gaps in startup instrumentation that block like-for-like comparison with the Expo baseline
- Capture crash-reporting edge cases that need follow-up once richer product flows exist

## Risks

| Risk                                                                   | Likelihood | Impact | Mitigation                                                                                                 |
| ---------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Event names drift from the Expo baseline before parity is established  | Med        | High   | Treat existing lifecycle events as the default contract and document any deliberate deviations immediately |
| Startup timing measures a shell placeholder rather than real readiness | Med        | Med    | Define one native baseline point now and carry it forward consistently through later phases                |
| Variant credentials or release identifiers are misconfigured           | Med        | High   | Validate each variant explicitly before closing the work item                                              |

## Validation

How to verify this work is correct:

- **Automated:** telemetry helper tests for event tagging, startup timing, and per-variant config selection
- **Manual:** launch each required variant, confirm PostHog lifecycle events and startup metrics, and trigger a safe test crash routed to the correct crash-reporting target
- **Regression:** root-shell launch and deep-link behavior must remain unchanged after telemetry is added

## Rollback

Disable native telemetry hooks, revert to the previous shell-only launch flow, and keep the migration baseline anchored to Expo until analytics and crash configuration are corrected.
