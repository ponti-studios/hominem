# Implementation Plan

## Goal

Native email and OTP auth parity

## Approach

Build the email and OTP flow as the primary signed-out path first, then verify its screen branching and error behavior against Expo. Keep the state model explicit so passkeys can plug into the same public auth shell afterward.

## Key Decisions

| Decision             | Choice                                                     | Rationale                                                      | Alternative Considered                                                        |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Public auth baseline | Email and OTP flow defines the default signed-out contract | Mirrors the current app and reduces auth-surface fragmentation | Building passkeys first, rejected because it would not cover the default path |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm the signed-out screen branches and OTP states to preserve

### 2. Implement the core path

- Build email entry, OTP verification, and auth-screen branching
- Preserve failure, retry, and success transitions from the Expo flow

### 3. Verify behavior with tests

- Add tests for auth-screen branching, OTP success, and failure states
- Verify the flow on device against the Expo reference

### 4. Capture follow-up work

- Record any signed-out auth states that must be shared with passkey work

## Risks

| Risk                                                    | Likelihood | Impact | Mitigation                                                                 |
| ------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Signed-out states drift from Expo during implementation | Med        | High   | Compare each branch and error state against the current flow during review |
| OTP edge cases are only partially covered               | Med        | High   | Include retry, invalid code, and expired code checks in verification       |

## Validation

How to verify this work is correct:

- **Automated:** auth-screen-state and OTP flow tests
- **Manual:** run email sign-in and OTP verification on device and compare to Expo
- **Regression:** passkey and later bootstrap work must be able to reuse the same public auth shell

## Rollback

Revert the native public email and OTP path and keep signed-out auth parity anchored to Expo until the state model is corrected.
