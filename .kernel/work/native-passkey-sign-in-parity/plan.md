# Implementation Plan

## Goal

Native passkey sign-in parity

## Approach

Layer passkey entry into the public auth shell after email and OTP behavior is stable. Keep success, cancellation, and unsupported-device handling explicit so backend and platform mismatches surface early.

## Key Decisions

| Decision     | Choice                                            | Rationale                               | Alternative Considered                                                                |
| ------------ | ------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| Passkey host | Reuse the same public auth shell as email sign-in | Keeps signed-out auth behavior coherent | Separate passkey-only entry surface, rejected because it would fragment auth behavior |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm supported passkey paths, cancellation behavior, and unsupported-device expectations

### 2. Implement the core path

- Add passkey initiation and completion to the native auth shell
- Handle cancellation, missing credential, and contract failure states

### 3. Verify behavior with tests

- Test supported and cancelled passkey flows where automation is possible
- Verify passkey behavior on device and compare against Expo

### 4. Capture follow-up work

- Record any differences that must also shape later passkey-management UI work

## Risks

| Risk                                                           | Likelihood | Impact | Mitigation                                                         |
| -------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| Platform passkey behavior differs from the Expo implementation | Med        | High   | Validate on real devices and treat contract mismatches as blockers |
| Unsupported-device behavior is not handled cleanly             | Med        | Med    | Include unsupported and cancelled paths in acceptance review       |

## Validation

How to verify this work is correct:

- **Automated:** targeted passkey flow tests where feasible
- **Manual:** complete passkey sign-in, cancellation, and failure checks on device
- **Regression:** email and OTP auth behavior must remain unchanged

## Rollback

Disable native passkey entry, revert to the prior public auth shell, and keep passkey parity anchored to Expo until contract issues are resolved.
