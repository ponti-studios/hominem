# Milestone Brief

## Goal

5.2 — Device control and telemetry parity: deliver app lock, screenshot prevention, notifications, review prompt, analytics parity, and startup metrics behavior matching the current app.

## Target Date

TBD

## Context

This milestone connects settings-driven preferences and observability to real device behavior. It is the bridge between core product parity and rollout-ready operational confidence.

Before this milestone: the settings surfaces may exist, but the full device-control and telemetry behavior they configure is not yet native. After this milestone: the native app can enforce those controls and report the operational signals Phase 6 will use for rollout decisions.

## Scope

### In scope

- App lock and screenshot-prevention behavior
- Notification and review-prompt behavior
- Analytics parity and startup metrics
- Device-control behavior surfaced earlier in settings

### Out of scope

- Camera and audio media behavior
- App intents, shortcuts, and widget integration

## Acceptance Criteria

This milestone is complete when:

- [ ] App lock and screenshot-prevention behavior work as configured from settings
- [ ] Notification, review-prompt, analytics, and startup metrics behavior match the current app closely enough for parity review
- [ ] Telemetry is stable enough for rollout-gate work in Phase 6
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **app-lock-screenshot-review-prompt-parity**: implement app lock, screenshot prevention, and review-prompt parity.
2. **notifications-analytics-and-startup-metrics**: implement notification behavior, lifecycle analytics parity, and startup metrics.

## Ownership

- DRI: mobile team
- User-facing behavior sign-off: product leadership
- Telemetry sign-off: engineering leadership

## Dependencies

- Phase 3 settings-surface parity
- Phase 1 and 1.2 variant configuration and observability foundations

## Risks

| Risk                                                                     | Impact | Mitigation                                                                                     |
| ------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| Settings surfaces and actual device behavior drift apart                 | High   | Verify settings-driven controls end to end on device before sign-off                           |
| Telemetry semantics change too much to support later rollout comparisons | High   | Preserve baseline event and metric meanings unless an explicit migration decision changes them |
