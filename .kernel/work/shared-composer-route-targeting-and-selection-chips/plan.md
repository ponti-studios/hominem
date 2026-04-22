# Implementation Plan

## Goal

Shared composer route targeting and selection-chip parity

## Approach

Build the shared host first so route visibility and targeting are stable before layering richer composer state. Treat selection chips as part of route targeting rather than as a separate UI system.

## Key Decisions

| Decision   | Choice                                      | Rationale                                                               | Alternative Considered                                                                 |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Host model | One shared composer across supported routes | Matches the current product architecture and avoids duplicated behavior | Separate per-route composers, rejected because it breaks parity and increases coupling |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm route visibility and targeting rules that must match Expo

### 2. Implement the core path

- Build shared composer host and route targeting behavior
- Recreate selection-chip behavior tied to those route targets

### 3. Verify behavior with tests

- Test host visibility and targeting transitions
- Verify cross-route composer behavior on device against Expo

### 4. Capture follow-up work

- Record draft and submit-state assumptions for the next work item

## Risks

| Risk                                                       | Likelihood | Impact | Mitigation                                                         |
| ---------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| The shared host drifts into route-specific behavior        | Med        | High   | Keep one host model and verify all route transitions during review |
| Selection-chip state becomes detached from route targeting | Med        | Med    | Treat both as one state model and test them together               |

## Validation

How to verify this work is correct:

- **Automated:** composer visibility and targeting tests
- **Manual:** verify inbox, notes, and chat host behavior on device
- **Regression:** chat route parity must remain stable

## Rollback

Disable advanced shared-composer behavior and return to simpler host placeholders until route-targeting parity is corrected.
