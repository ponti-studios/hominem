# Milestone Brief

## Goal

2.2 — Session bootstrap parity: restore returning sessions, profile recovery, and auth redirect behavior so the native app launches into the same signed-in or signed-out destinations as Expo.

## Target Date

TBD

## Context

This milestone makes launch state trustworthy. It sits between public auth entry and the protected shell because later phases need stable restore and redirect semantics more than they need additional screens.

Before this milestone: a user may sign in, but cold launch and session recovery are not yet dependable. After this milestone: the native app can resume into the correct route or signed-out state using the same bootstrap rules as Expo.

## Scope

### In scope

- Session storage, auth-provider behavior, and auth-header parity
- Boot sequence, restore logic, profile recovery, and expired-session handling
- Auth redirect behavior for cold launch and returning users
- Launch-state handling needed by the protected shell

### Out of scope

- Protected tab shell and onboarding UI delivery
- Inbox, notes, and other product-surface parity

## Acceptance Criteria

This milestone is complete when:

- [ ] Returning users restore into the same signed-in or signed-out states as the Expo app
- [ ] Expired sessions, partial profile state, and missing credentials follow the expected redirect behavior
- [ ] Auth-provider and auth-header behavior are stable enough for protected data access in later phases
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-session-storage-and-auth-provider**: implement secure session storage, auth-provider lifecycle, sign-out handling, and auth-header parity.
2. **native-boot-sequence-and-redirect-parity**: recreate boot sequencing, profile recovery, expired-session handling, and redirect parity on launch.

## Dependencies

- Milestone 2.1 public auth parity
- Auth cookie, session, and profile-recovery contract must remain stable

## Risks

| Risk                                                               | Impact | Mitigation                                                                               |
| ------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| Restore behavior diverges for expired or partial sessions          | High   | Map every bootstrap state explicitly before implementation closes                        |
| Auth headers or provider lifecycle drift from backend expectations | High   | Validate native request setup against current Expo auth behavior during milestone review |
