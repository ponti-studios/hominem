# Implementation Plan

## Goal

Archived sessions, app lock, and screenshot settings parity

## Approach

Add archived-session access first, then verify preference toggles through the same settings host. Keep the work bounded to settings-surface behavior so later device-control implementation can build on it without undoing the route structure.

## Key Decisions

| Decision         | Choice                                                                                 | Rationale                                            | Alternative Considered                                                                 |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Surface boundary | Archived sessions and preference toggles are delivered as settings-surface parity only | Keeps Phase 3 focused on daily-use settings behavior | Pulling full device-control logic into Phase 3, rejected because it belongs in Phase 5 |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm archived-session resume and settings-toggle behaviors that must match Expo

### 2. Implement the core path

- Build archived-session route behavior and resume flow
- Add app-lock and screenshot preference surfaces to settings

### 3. Verify behavior with tests

- Test archived-session route and preference toggle behavior
- Verify flows on device against Expo

### 4. Capture follow-up work

- Record any settings-to-device-control assumptions that Phase 5 must preserve

## Risks

| Risk                                                                           | Likelihood | Impact | Mitigation                                                                            |
| ------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------- |
| Archived-session behavior depends on state transitions not preserved in native | Med        | High   | Validate open, resume, and return behavior on device                                  |
| Preference toggles appear functional but do not match later host behavior      | Med        | Med    | Keep this milestone scoped to settings-surface parity and document later dependencies |

## Validation

How to verify this work is correct:

- **Automated:** archived-session and preference-surface tests
- **Manual:** verify archived-session access, app-lock toggle, and screenshot settings on device
- **Regression:** core settings host and account behavior must remain stable

## Rollback

Revert archived-session and preference-specific settings behavior to placeholder states until parity issues are corrected.
