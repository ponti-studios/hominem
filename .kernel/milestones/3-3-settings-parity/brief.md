# Milestone Brief

## Goal

3.3 — Settings parity: deliver account, passkey-management, archived-session, app-lock, and screenshot-preference behavior matching the Expo app.

## Target Date

TBD

## Context

This milestone closes Phase 3 by connecting account and device-preference surfaces to the native auth and shell foundations. It also validates settings-driven behavior that later device-feature phases must preserve.

Before this milestone: users can navigate the shell, but settings remain incomplete. After this milestone: account management, archived sessions, and key preference surfaces behave like the current app and are ready for later device integrations.

## Scope

### In scope

- Settings route, account-editing, and passkey-management surface wiring
- Archived chats or sessions route and resume behavior
- App-lock toggle and screenshot-preference parity at the settings-surface level
- Settings-side integration with Phase 2 auth and shell foundations

### Out of scope

- Full device-control implementation beyond settings-surface wiring
- Chat, composer, and media product parity

## Acceptance Criteria

This milestone is complete when:

- [ ] Account editing and passkey-management surfaces behave like the current app
- [ ] Archived-session access and resume behavior are stable on device
- [ ] App-lock and screenshot preferences are configurable from native settings with parity-grade behavior
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **settings-account-and-passkey-management**: implement the native settings route, account editing, and passkey-management surface wiring.
2. **archived-sessions-app-lock-and-screenshot-settings**: implement archived-session access plus settings-surface parity for app-lock and screenshot preferences.

## Dependencies

- Phase 2 auth and protected-shell foundations
- Stable archived-session and settings contract from the current app

## Risks

| Risk                                                                           | Impact | Mitigation                                                                          |
| ------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| Settings surface hides auth or device dependencies not yet explicit            | High   | Validate account and passkey surfaces against the current auth model before closure |
| Archived-session behavior depends on state transitions not preserved in native | High   | Verify open, resume, and return behavior on device during sign-off                  |
