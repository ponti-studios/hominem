# Implementation Plan

## Goal

Native onboarding and profile gating parity

## Approach

Model onboarding as a gating outcome of the bootstrap state machine, not as a separate auth path. Verify first-run and returning-user outcomes before the protected shell begins to depend on them.

## Key Decisions

| Decision      | Choice                                     | Rationale                                                            | Alternative Considered                                                     |
| ------------- | ------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Gating source | Bootstrap facts drive onboarding decisions | Keeps launch-state behavior coherent across auth and protected entry | Independent onboarding checks, rejected because they would duplicate state |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm first-run, incomplete-profile, and completed-profile outcomes to preserve

### 2. Implement the core path

- Build onboarding routing and profile-completion gating
- Recreate first-run redirect semantics after auth or restore

### 3. Verify behavior with tests

- Test profile-gating outcomes and onboarding entry logic
- Verify first-run behavior on device against Expo

### 4. Capture follow-up work

- Record shell assumptions that Phase 3 will depend on when hosting migrated screens

## Risks

| Risk                                                   | Likelihood | Impact | Mitigation                                                           |
| ------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------- |
| Onboarding starts from the wrong bootstrap outcome     | Med        | High   | Keep onboarding decisions coupled to the tested launch-state machine |
| UI polish obscures parity issues in first-run behavior | Low        | Med    | Prioritize route and state correctness over presentation detail      |

## Validation

How to verify this work is correct:

- **Automated:** profile-gating and onboarding-entry tests
- **Manual:** verify new-user, incomplete-profile, and completed-profile launch paths on device
- **Regression:** session restore and signed-out auth flows must remain stable

## Rollback

Revert native onboarding gating and return incomplete-profile behavior to placeholder handling until the gating contract is corrected.
