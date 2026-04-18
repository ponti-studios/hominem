# Implementation Plan

## Goal

Notifications, analytics, and startup metrics parity

## Approach

Validate notifications and lifecycle telemetry on the same settled app host used by the rest of Phase 5. Keep metrics narrow and comparable so Phase 6 can use them directly for rollout gating, and do not serialize this work behind the app-lock lane once settings and lifecycle hooks are stable.

## Key Decisions

| Decision         | Choice                                                | Rationale                              | Alternative Considered                                           |
| ---------------- | ----------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Metrics boundary | Startup and lifecycle metrics stay comparable to Expo | Enables meaningful rollout gates later | Defining new metrics now, rejected because it weakens comparison |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm notification and lifecycle metrics that must match Expo

### 2. Implement the core path

- Build notification behavior and lifecycle analytics parity
- Recreate startup metrics needed for rollout decisions

### 3. Verify behavior with tests

- Test event and metric helpers where feasible
- Verify notifications and metrics on device across required variants

### 4. Capture follow-up work

- Record which metrics and signals Phase 6 should consume directly

## Risks

| Risk                                                                | Likelihood | Impact | Mitigation                                                     |
| ------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------- |
| Variant differences pollute analytics comparisons                   | Med        | High   | Verify metrics and event tagging in each required variant      |
| Notification behavior is partially implemented and appears complete | Med        | Med    | Validate real delivery and user-visible behavior during review |

## Validation

How to verify this work is correct:

- **Automated:** lifecycle analytics and metric helper tests
- **Manual:** verify notification behavior and startup metrics on device across variants
- **Regression:** earlier observability foundations must remain stable

## Rollback

Disable native notification and advanced telemetry behavior while preserving the existing baseline instrumentation until parity issues are corrected.
