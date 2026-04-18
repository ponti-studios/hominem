# Implementation Plan

## Goal

Shared attachment state across notes, chat, and local cache parity

## Approach

Map one shared attachment-state model across note and conversation hosts, then verify insertion and removal behavior in both contexts. Keep source-of-attachment concerns out of scope until the media phase.

## Key Decisions

| Decision    | Choice                                             | Rationale                                    | Alternative Considered                                                             |
| ----------- | -------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| State model | Shared attachment state across note and chat hosts | Reduces drift and duplicated edge-case logic | Separate host-specific state models, rejected because they would fragment behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm attachment insertion, removal, and local-state behaviors that must match Expo

### 2. Implement the core path

- Build shared attachment-state behavior across note and chat hosts
- Recreate insertion and removal semantics in each host

### 3. Verify behavior with tests

- Test attachment-state transitions where feasible
- Verify note and chat attachment flows on device against Expo

### 4. Capture follow-up work

- Record media-source assumptions Phase 5 must preserve

## Risks

| Risk                                                         | Likelihood | Impact | Mitigation                                                        |
| ------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------- |
| One host behaves correctly while the other drifts            | Med        | High   | Review note and chat attachment behavior together before closure  |
| Local cache behavior is insufficient for later media sources | Med        | Med    | Keep the state model explicit and document any Phase 5 follow-ups |

## Validation

How to verify this work is correct:

- **Automated:** attachment-state transition tests where feasible
- **Manual:** verify note and chat insertion and removal behavior on device
- **Regression:** upload lifecycle and shared-composer behavior must remain stable

## Rollback

Revert shared attachment-state behavior to a simpler host-specific placeholder approach until parity issues are corrected.
