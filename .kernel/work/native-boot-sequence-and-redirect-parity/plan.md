# Implementation Plan

## Goal

Native boot sequence and redirect parity

## Approach

Build the bootstrap state machine from explicit session and profile facts rather than implicit view logic. Verify every supported launch state against Expo before allowing the protected shell to depend on it.

## Key Decisions

| Decision        | Choice                        | Rationale                                       | Alternative Considered                                        |
| --------------- | ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Bootstrap model | Explicit launch-state machine | Makes redirect behavior testable and reviewable | Implicit view branching, rejected because it hides edge cases |

## Implementation Steps

### 1. Clarify scope and success criteria

- Enumerate signed-out, expired-session, partial-profile, and fully-restored launch states

### 2. Implement the core path

- Build launch-state transitions and redirect outcomes
- Recreate profile recovery and expired-session handling

### 3. Verify behavior with tests

- Test each bootstrap state and redirect branch
- Verify restore behavior on device against the Expo app

### 4. Capture follow-up work

- Record any bootstrap outcomes that constrain onboarding or protected-shell delivery

## Risks

| Risk                                                                | Likelihood | Impact | Mitigation                                                              |
| ------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------- |
| A bootstrap edge case is missed during migration                    | Med        | High   | Review every launch state explicitly and keep it in automated coverage  |
| Redirect parity is validated only after protected-shell work starts | Med        | High   | Treat bootstrap mismatches as blockers before later Phase 2 work begins |

## Validation

How to verify this work is correct:

- **Automated:** launch-state and redirect tests for all supported session states
- **Manual:** cold-launch into signed-out, expired-session, partial-profile, and restored-user scenarios on device
- **Regression:** public sign-in and sign-out behavior must remain stable

## Rollback

Disable native restore and redirect handling, return to the prior signed-out-only launch flow, and keep restore parity anchored to Expo until the state machine is corrected.
