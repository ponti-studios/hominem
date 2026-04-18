# Implementation Plan

## Goal

Protected shell, tab navigation, and app lock foundation parity

## Approach

Attach the protected shell to the tested onboarding outcomes, then build the tab host and route-guard behavior around that contract. Keep app-lock work at the foundation level so later phases can extend it without refactoring the shell.

## Key Decisions

| Decision       | Choice                                               | Rationale                        | Alternative Considered                                              |
| -------------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| Shell boundary | Reuse the current protected-shell and tab-host shape | Minimizes later navigation churn | Designing a new shell, rejected because it would delay later phases |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm the protected-shell host behaviors and app-lock hooks required by later phases

### 2. Implement the core path

- Build protected shell composition, route guard, and tab navigation host
- Add app-lock foundations needed for later settings and device-control phases

### 3. Verify behavior with tests

- Test protected entry and route-guard behavior
- Verify shell hosting and tab transitions on device

### 4. Capture follow-up work

- Record shell assumptions that later surface phases depend on

## Risks

| Risk                                                              | Likelihood | Impact | Mitigation                                                                    |
| ----------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------- |
| Protected shell boundaries drift from Expo                        | Med        | High   | Mirror the current shell structure and review hosting behavior before closure |
| App-lock work expands into full device-control delivery too early | Med        | Med    | Limit scope to host foundations only                                          |

## Validation

How to verify this work is correct:

- **Automated:** route-guard and protected-shell tests
- **Manual:** verify protected entry, tab navigation, and app-lock host behavior on device
- **Regression:** onboarding and bootstrap outcomes must remain stable

## Rollback

Revert native protected-shell and tab-host behavior to placeholder routing until the shell contract is corrected.
