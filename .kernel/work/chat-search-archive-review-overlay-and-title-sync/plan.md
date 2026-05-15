# Implementation Plan

## Goal

Chat search, archive, overlay, and title sync parity

## Approach

Layer search, archive, overlay, and title updates onto the stable conversation route after the base host is working. Validate each state transition directly so the shared composer milestone inherits a clean conversation surface.

## Key Decisions

| Decision           | Choice                                                    | Rationale                                                         | Alternative Considered                                            |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Overlay sequencing | Overlay and archive behavior land after base route parity | Keeps route-host issues separate from state-transition complexity | Building them together, rejected because it blurs failure sources |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm search, archive, review-overlay, and title-sync behaviors to preserve

### 2. Implement the core path

- Build search and archive behavior
- Recreate review-overlay and session-title update behavior

### 3. Verify behavior with tests

- Test state transitions for search, archive, and overlay flows
- Verify behavior on device against Expo

### 4. Capture follow-up work

- Record route-state assumptions the shared composer depends on

## Risks

| Risk                                                       | Likelihood | Impact | Mitigation                                     |
| ---------------------------------------------------------- | ---------- | ------ | ---------------------------------------------- |
| Overlay behavior introduces unstable route transitions     | Med        | High   | Verify state changes explicitly before closure |
| Title-sync behavior drifts from current conversation rules | Med        | Med    | Compare title updates directly during review   |

## Validation

How to verify this work is correct:

- **Automated:** search, archive, and overlay state tests
- **Manual:** verify conversation search and archive flows plus review overlay on device
- **Regression:** base conversation route behavior must remain stable

## Rollback

Disable advanced overlay and archive behavior while preserving the base conversation route until parity issues are resolved.
