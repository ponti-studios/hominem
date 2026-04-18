# Implementation Plan

## Goal

Chat message list and conversation action parity

## Approach

Build the conversation route and message rendering first so later overlay and composer work start from a stable host. Keep the action set limited to the core route behaviors required for parity at this stage.

## Key Decisions

| Decision                  | Choice                                                             | Rationale                          | Alternative Considered                                                                   |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Route-first chat delivery | Message rendering and route actions land before overlay complexity | Stabilizes the host for later work | Building search and overlays immediately, rejected because it obscures base-route issues |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm conversation actions and route behavior that must match Expo

### 2. Implement the core path

- Build chat route, message list, and core conversation actions
- Recreate route-state behavior needed by the conversation host

### 3. Verify behavior with tests

- Test chat route and action behavior
- Verify conversation rendering on device against Expo

### 4. Capture follow-up work

- Record overlay and title-sync constraints for the next work item

## Risks

| Risk                                                           | Likelihood | Impact | Mitigation                                                           |
| -------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Route parity looks correct while action behavior is incomplete | Med        | High   | Validate route actions explicitly during review                      |
| Conversation state becomes too tied to one route host          | Med        | Med    | Keep route state generic enough for later overlays and composer work |

## Validation

How to verify this work is correct:

- **Automated:** chat route and action tests
- **Manual:** verify conversation rendering and route actions on device
- **Regression:** note-to-chat handoff from Phase 3 must remain stable

## Rollback

Revert native conversation-route behavior to placeholder hosting until route parity is corrected.
