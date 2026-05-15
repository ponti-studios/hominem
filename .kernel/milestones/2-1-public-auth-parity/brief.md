# Milestone Brief

## Goal

2.1 — Public auth parity: deliver native sign-in entry, OTP verification, and passkey sign-in behavior matching the Expo app.

## Target Date

TBD

## Context

This milestone is the public entry point for the native app. It must recreate the same sign-in methods and branching behavior users see today before session bootstrap and protected-shell work can begin.

Before this milestone: the native app can launch, but it does not yet support real sign-in. After this milestone: users can begin authentication through email and passkeys with matching loading, error, and verification behavior.

## Scope

### In scope

- Email sign-in entry and OTP verification flow parity
- Auth-screen branching and loading or error state parity
- Native passkey sign-in initiation and completion
- Public auth navigation stack and handoff into later bootstrap state

### Out of scope

- Returning-session restore and redirect behavior
- Protected shell, onboarding, and tab navigation

## Acceptance Criteria

This milestone is complete when:

- [ ] A signed-out user can begin email auth, complete OTP verification, and reach the same next state as in Expo
- [ ] A signed-out user can start and complete supported passkey sign-in flows on device
- [ ] Public auth loading, error, retry, and branching behavior match the current app closely enough for parity review
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-email-otp-auth-parity**: implement email sign-in entry, OTP verification, auth-screen branching, and parity for error and retry states.
2. **native-passkey-sign-in-parity**: implement passkey sign-in initiation, completion, and parity for credential and cancellation paths.

## Dependencies

- Phase 1 native shell, routing, and observability foundation
- Frozen auth endpoint and OTP contract from the current backend

## Risks

| Risk                                                               | Impact | Mitigation                                                                        |
| ------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------- |
| Email or OTP UX drifts from the current auth-screen-state behavior | High   | Trace each screen branch against the Expo auth flow before closing the milestone  |
| Passkey behavior differs across devices or credential states       | High   | Verify happy path, cancellation, and unsupported-device behavior on real hardware |
