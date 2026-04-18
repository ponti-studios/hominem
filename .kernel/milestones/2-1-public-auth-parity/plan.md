# Milestone Plan

## Goal

2.1 — Public auth parity

## Approach

Ship email and OTP parity first, then add passkey sign-in on top of the same public auth stack. The milestone stays focused on signed-out entry behavior and stops short of session restore and protected-shell routing.

## Work Item Breakdown

| Work Item                     | Purpose                                                                                       | Depends On                   |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| native-email-otp-auth-parity  | Email entry, OTP verification, auth-screen branching, and parity for loading and error states | none                         |
| native-passkey-sign-in-parity | Passkey sign-in initiation, completion, and cancellation parity                               | native-email-otp-auth-parity |

## Critical Path

`native-email-otp-auth-parity` is the bottleneck because it establishes the public auth stack and screen-state model that passkey flows must plug into.

## Sequencing Rationale

Email and OTP come first because they define the primary public auth presentation and state model. Passkeys layer into that same entry surface afterward, which keeps the milestone from splitting into parallel auth implementations.

## Deliverables

- Native public auth stack with sign-in entry and OTP verification
- Auth-screen branching parity for signed-out states
- Passkey sign-in flow integrated into the same public auth shell

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Email, OTP, and passkey entry flows work on device with parity-grade behavior
- [ ] Public auth errors and retries are verified against the Expo flow

## Risks

| Risk                                                    | Likelihood | Impact | Mitigation                                                                           |
| ------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------ |
| Signed-out entry states are simplified too aggressively | Med        | High   | Preserve the current auth-screen branching rules as the default contract             |
| Passkey flows expose backend or platform contract gaps  | Med        | High   | Treat contract mismatches as blockers and document them before closing the milestone |

## Open Questions

- Which exact signed-out error states must render bespoke UI rather than generic failure messaging? Owner: mobile team. Deadline: before the email and OTP work exits.
- Are there any passkey flows intentionally unsupported today that should remain out of scope for parity? Owner: backend and mobile team. Deadline: before the passkey work exits.
