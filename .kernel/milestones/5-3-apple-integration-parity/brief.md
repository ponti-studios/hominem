# Milestone Brief

## Goal

5.3 — Apple integration parity: deliver app intents, shortcut donation, app-group coordination, and Control Center widget behavior matching the current app.

## Target Date

TBD

## Context

This milestone closes the Apple-platform-specific portion of the migration. It ties the native app into system entry points and shared data surfaces that Expo could only partially support.

Before this milestone: the app can run core product and device-control behavior, but system integrations remain incomplete. After this milestone: shortcuts, intents, app groups, and the widget route into the native app with parity-grade behavior. Implementation can overlap with 5.2 once route and entitlement contracts are stable, but sign-off requires full cross-variant validation before Phase 6 begins.

## Scope

### In scope

- App intents and shortcut donation parity
- App-group coordination between app and extension targets
- Control Center widget routing and target integration
- Variant-safe integration of system-facing Apple targets

### Out of scope

- Core chat, notes, or settings parity already delivered in earlier phases
- Rollout gating and cutover execution

## Acceptance Criteria

This milestone is complete when:

- [ ] Shortcuts and app-intent entry points open the correct native destinations
- [ ] App-group coordination and Control Center widget behavior work across the required variants
- [ ] Apple-platform integrations are stable enough for rollout validation in Phase 6
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **app-intents-shortcut-donation-and-app-groups**: implement app intents, shortcut donation, and shared app-group coordination.
2. **control-center-widget-routing-and-target-integration**: implement widget routing, target wiring, and variant-safe system integration.

## Ownership

- DRI: mobile team
- Product-surface sign-off: product leadership
- Variant and entitlement sign-off: mobile team

## Dependencies

- Phase 1 variant and entitlement setup
- Stable native route destinations from earlier migration phases

## Risks

| Risk                                                                    | Impact | Mitigation                                                                           |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| App groups or entitlements drift across variants                        | High   | Validate each target and variant explicitly before sign-off                          |
| Widget and app-intent routes diverge from the main app's route contract | High   | Keep system entry points mapped into the same destination vocabulary as the main app |
