# Implementation Plan

## Goal

App intents, shortcut donation, and app-group parity

## Approach

Define the shared system-entry and shared-data contract first, then implement app intents and shortcut donation against it. Keep widget-specific target behavior out of scope until the contract is explicit, but make that contract available early enough that widget work can begin in parallel once it stops moving.

## Key Decisions

| Decision              | Choice                                                                        | Rationale                                                     | Alternative Considered                                                    |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| System-entry contract | App intents and shortcuts use the same destination vocabulary as the main app | Prevents drift between system entry points and app navigation | Separate destination mapping, rejected because it would fragment behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm system-entry destinations and shared-data behavior to preserve

### 2. Implement the core path

- Build app intents and shortcut donation behavior
- Recreate shared app-group coordination required by system entry points

### 3. Verify behavior with tests

- Test shared-data and routing helpers where feasible
- Verify shortcut and intent entry behavior on device

### 4. Capture follow-up work

- Record contract assumptions needed by widget and extension-target work

## Risks

| Risk                                                          | Likelihood | Impact | Mitigation                                                   |
| ------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------ |
| Shared-data behavior is under-specified for extension targets | Med        | High   | Make the app-group contract explicit before closure          |
| System entry points route differently than the main app       | Med        | High   | Reuse one destination vocabulary and verify it during review |

## Validation

How to verify this work is correct:

- **Automated:** routing and shared-data helper tests where feasible
- **Manual:** verify app-intent and shortcut entry on device against expected destinations
- **Regression:** core app routing must remain stable

## Rollback

Disable new system entry points and return to the previous app-only navigation path until parity issues are corrected.
