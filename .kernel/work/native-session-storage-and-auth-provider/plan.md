# Implementation Plan

## Goal

Native session storage and auth provider parity

## Approach

Define the native session facts first, then wire the auth provider and protected request headers around them. This work stays below the redirect layer so launch-state logic can build on stable inputs.

## Key Decisions

| Decision         | Choice                                                               | Rationale                                   | Alternative Considered                                                      |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Session boundary | Storage and provider lifecycle are implemented before boot redirects | Separates state facts from launch decisions | Folding redirects into provider logic, rejected because it hides edge cases |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm storage, sign-out, and header behavior that must remain stable

### 2. Implement the core path

- Build native session storage and auth-provider lifecycle
- Reproduce protected request header behavior and sign-out handling

### 3. Verify behavior with tests

- Test storage, sign-out, and auth-header helpers
- Verify provider lifecycle against current protected access expectations

### 4. Capture follow-up work

- Record any storage edge cases that must feed the boot-sequence work item

## Risks

| Risk                                                     | Likelihood | Impact | Mitigation                                                           |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Session state omits fields required for bootstrap parity | Med        | High   | Verify the native model against every bootstrap state before closure |
| Header behavior differs subtly from Expo                 | Med        | High   | Compare protected request behavior directly during review            |

## Validation

How to verify this work is correct:

- **Automated:** session-storage and auth-header tests
- **Manual:** sign in, sign out, and verify protected request setup on device
- **Regression:** public auth flows must continue to function unchanged

## Rollback

Revert native session persistence and provider lifecycle to the prior signed-out-only baseline until the session model is corrected.
