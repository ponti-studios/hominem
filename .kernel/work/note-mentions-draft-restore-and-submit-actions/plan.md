# Implementation Plan

## Goal

Note mentions, draft restore, and submit action parity

## Approach

Layer draft and mention behavior onto the stable shared host, then verify submit semantics against current route and target behavior. Keep attachment state out of scope so the milestone stays focused on core composer state.

## Key Decisions

| Decision       | Choice                                            | Rationale                                                        | Alternative Considered                                                                |
| -------------- | ------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Draft boundary | Draft and submit behavior land before attachments | Keeps core composer state stable before file complexity is added | Building attachments at the same time, rejected because it would blur state ownership |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm draft restore, note mention, and submit behaviors to preserve

### 2. Implement the core path

- Build note mention and draft restore behavior
- Recreate primary and secondary submit actions

### 3. Verify behavior with tests

- Test draft restore and submit-state transitions
- Verify composer behavior on device against Expo

### 4. Capture follow-up work

- Record any file-state assumptions needed by the attachment milestone

## Risks

| Risk                                                            | Likelihood | Impact | Mitigation                                                          |
| --------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------- |
| Draft restore breaks under route changes or interrupted flows   | Med        | High   | Verify route transitions explicitly during review                   |
| Mention targeting and submit actions hide route-coupling issues | Med        | Med    | Keep route-targeting behavior explicit and tested with submit flows |

## Validation

How to verify this work is correct:

- **Automated:** draft, mention, and submit-state tests
- **Manual:** verify cross-route composer behavior on device with note mentions and submit actions
- **Regression:** shared-composer host behavior must remain stable

## Rollback

Disable advanced composer state behaviors and return to simpler shared-host functionality until parity issues are corrected.
