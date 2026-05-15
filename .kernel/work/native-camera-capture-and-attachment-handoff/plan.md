# Implementation Plan

## Goal

Native camera capture and attachment handoff parity

## Approach

Build camera capture around the already-migrated attachment hosts and validate the handoff path as the first hard proof of the shared media-host contract. Keep source-state behavior explicit so failure and cancellation remain diagnosable and useful to the sibling audio work.

## Key Decisions

| Decision      | Choice                                                        | Rationale                             | Alternative Considered                                                                       |
| ------------- | ------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Host boundary | Camera output enters the same attachment hosts as other files | Preserves one shared attachment model | Creating a camera-specific attachment path, rejected because it would fragment file behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm capture, cancellation, and handoff behavior to preserve

### 2. Implement the core path

- Build camera capture and host handoff behavior
- Recreate cancellation and basic failure handling

### 3. Verify behavior with tests

- Test capture-state transitions where feasible
- Verify camera capture in note and chat hosts on device

### 4. Capture follow-up work

- Record media-host assumptions needed by later audio and speech work

## Risks

| Risk                                                            | Likelihood | Impact | Mitigation                                                |
| --------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------- |
| Camera capture succeeds but host handoff fails under real usage | Med        | High   | Validate end-to-end inside supported hosts before closure |
| Permission behavior differs from Expo expectations              | Med        | Med    | Include permission-denied scenarios in verification       |

## Validation

How to verify this work is correct:

- **Automated:** targeted capture-state tests where feasible
- **Manual:** capture media and hand it off into note and chat hosts on device
- **Regression:** attachment and composer behavior must remain stable

## Rollback

Disable native camera-source behavior and keep attachment hosts limited to existing non-camera flows until parity issues are corrected.
