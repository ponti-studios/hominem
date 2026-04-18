# Implementation Plan

## Goal

Top-anchor restoration and inbox sync parity

## Approach

Treat anchor restoration as a state-preservation problem, not just a list-UI detail. Validate user context before and after refreshes and updates until the native behavior is stable on device.

## Key Decisions

| Decision            | Choice                                             | Rationale                                                          | Alternative Considered                                             |
| ------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Verification target | Real-device anchor behavior is the source of truth | Native scroll behavior can differ materially from simulator output | Simulator-first sign-off, rejected because it misses parity issues |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm which scroll-restoration scenarios must be preserved for parity sign-off

### 2. Implement the core path

- Build top-anchor restoration and feed update synchronization
- Preserve user context during refresh and update events

### 3. Verify behavior with tests

- Add targeted tests for anchor and update-state behavior where feasible
- Verify scroll-restoration behavior on device against Expo

### 4. Capture follow-up work

- Record which parts of the anchor model later note or chat surfaces may need to reuse

## Risks

| Risk                                                                 | Likelihood | Impact | Mitigation                                                               |
| -------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Native list primitives do not support parity-grade behavior directly | Med        | High   | Validate early and treat anchor gaps as blockers rather than polish work |
| Update synchronization behaves differently under larger feeds        | Med        | Med    | Test with realistic feed updates before closure                          |

## Validation

How to verify this work is correct:

- **Automated:** targeted state and anchor tests where feasible
- **Manual:** verify top-anchor preservation during refresh and update scenarios on device
- **Regression:** inbox route rendering and refresh behavior must remain stable

## Rollback

Revert advanced anchor-restoration behavior to a simpler inbox state while preserving feed correctness until the parity issue is resolved.
