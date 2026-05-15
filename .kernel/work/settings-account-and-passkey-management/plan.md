# Implementation Plan

## Goal

Settings account and passkey management parity

## Approach

Build the settings host and core account surfaces first so later archived-session and preference behavior has a stable home. Keep the passkey surface tied to current auth assumptions rather than anticipating future feature work.

## Key Decisions

| Decision                | Choice                                                                        | Rationale                                                       | Alternative Considered                                                         |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Settings-first delivery | Account and passkey surfaces land before archived-session and preference work | Stabilizes the core host before layering more specialized flows | Building archived sessions first, rejected because it depends on the same host |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm account-editing and passkey-surface behavior that must match Expo

### 2. Implement the core path

- Build settings host and account-editing behavior
- Wire passkey-management surfaces into the native settings route

### 3. Verify behavior with tests

- Test account and settings-route behaviors
- Verify settings and passkey surfaces on device against Expo

### 4. Capture follow-up work

- Record host assumptions needed by archived sessions and preference toggles

## Risks

| Risk                                                                   | Likelihood | Impact | Mitigation                                                                 |
| ---------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Passkey surface parity is blocked by auth assumptions not yet explicit | Med        | High   | Validate the settings surface against Phase 2 auth contracts during review |
| The settings host becomes too specific to account behavior             | Med        | Med    | Keep the route structure reusable for later settings subsections           |

## Validation

How to verify this work is correct:

- **Automated:** settings route and account-surface tests
- **Manual:** verify account editing and passkey-management behavior on device
- **Regression:** auth and protected-shell behavior must remain stable

## Rollback

Revert native settings account surfaces to placeholder hosting until account and passkey parity are corrected.
