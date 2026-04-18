# Milestone Brief

## Goal

2.3 — Protected shell readiness: deliver onboarding, protected routing, and tab shell behavior that can safely host migrated product routes.

## Target Date

TBD

## Context

This milestone completes Phase 2 by turning bootstrap decisions into real protected navigation behavior. It is the gate between auth work and the first daily-use product surfaces in Phase 3.

Before this milestone: launch restore may work, but the native app still lacks the full protected shell shape expected by inbox, notes, and settings. After this milestone: the native app can host migrated protected routes behind the same onboarding and tab-shell rules as Expo.

## Scope

### In scope

- Protected route shell and auth-route-guard parity
- Onboarding flow and profile-gating behavior
- Native tab shell structure and shared shell composition
- App lock foundations needed by later settings and device-feature work

### Out of scope

- Inbox, notes, settings, and chat product parity beyond route hosting
- Full screenshot-prevention and device-control behavior beyond foundational wiring

## Acceptance Criteria

This milestone is complete when:

- [ ] Protected routes, onboarding, and tab-shell entry behavior match the Expo app
- [ ] The native shell can host placeholders or migrated screens for inbox, notes, chat, and settings
- [ ] App-lock foundations are wired sufficiently for later settings and device-feature phases
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-onboarding-profile-gating**: implement onboarding flow, profile gating, and first-run redirect behavior.
2. **protected-shell-tab-navigation-and-app-lock**: implement protected shell composition, tab navigation, route guarding, and app-lock foundations.

## Dependencies

- Milestone 2.2 session bootstrap parity
- Stable route inventory from Phase 1 placeholder shell

## Risks

| Risk                                                                      | Impact | Mitigation                                                                                     |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Onboarding behavior diverges from existing profile-completion rules       | High   | Keep first-run and returning-user gating tied to the bootstrap contract from Milestone 2.2     |
| Protected shell structure is too unlike Expo to host later routes cleanly | High   | Mirror the current tab-shell and route-guard boundaries instead of inventing a new shell shape |
