# Milestone Brief

## Goal

1.2 — Routing shell, deep links, and observability

## Target Date

2025-06-15

## Context

This milestone turns the Phase 1 native foundation into a usable application shell. After Milestone 1.1 creates the Xcode project, variants, and SwiftUI primitives, Milestone 1.2 adds the root app container, placeholder route structure, deep-link resolution, and release-grade observability.

Before this milestone: the native app can build, but it does not yet provide a load-bearing app shell, route placeholders, or telemetry needed for later parity comparisons.

After this milestone: the native app launches into a placeholder shell, resolves supported URLs and native intent entry paths, and emits the analytics, crash, and startup instrumentation required for Phase 2 and later phases.

## Scope

### In scope

- Root app container and placeholder shell for public auth, protected app, notes, chat, settings, and fallback screens
- Native URL router for `hakumi://` and `https://hakumi.app/` deep links plus native-intent entry handling
- Placeholder route shells for all major top-level destinations referenced in the parity matrix
- PostHog lifecycle events, startup instrumentation, and crash reporting wiring per variant
- Release and environment plumbing needed for telemetry to distinguish dev, e2e, preview, and production builds

### Out of scope

- Any product-surface parity beyond placeholder shells
- Auth session restore, onboarding, protected-route gating, and tab-shell behavior beyond the minimum shell structure required by Phase 2
- App intents, widget targets, notifications, and media flows

## Acceptance Criteria

This milestone is complete when:

- [ ] The native app launches into a root shell that can display placeholder routes for auth, inbox, notes, chat, settings, not-found, and error surfaces
- [ ] `hakumi://` and `https://hakumi.app/` URLs resolve into the correct placeholder destinations without crashes on device
- [ ] Native-intent entry paths can hand off into the same routing layer as standard deep links
- [ ] PostHog receives launch and lifecycle events with correct variant tagging, startup metrics are recorded, and crash reporting is configured per variant
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

<!-- These become kernel/work/<id>/ entries. List in execution order. -->

1. **implement-native-url-router-with-deep-link-handling-and-placehol**: build the root app container, placeholder route shells, deep-link parser, and native-intent routing bridge. Prerequisite: Milestone 1.1 is complete enough that the native shell can render SwiftUI primitives and environment configuration.
2. **wire-posthog-analytics-startup-instrumentation-and-crash-reporti**: wire PostHog lifecycle events, startup metrics, and crash reporting into the root app lifecycle with per-variant configuration. Prerequisite: the root shell exists and app launch flow is stable enough to instrument.

## Dependencies

- Milestone 1.1 must provide a buildable Xcode project, app variants, and shared SwiftUI primitives
- Variant environment configuration must be stable enough to map analytics keys and crash-reporting DSNs correctly
- URL schemes, associated domains, and intent-entry expectations must remain aligned with the current Expo app contract

## Risks

| Risk                                                                                         | Impact | Mitigation                                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Deep-link behavior diverges from the Expo app's current route expectations                   | High   | Reuse the existing route inventory as the placeholder destination map and verify on device before closing the router work item |
| Telemetry is wired before launch flow is stable, producing noisy or misleading baseline data | Med    | Make the router and root shell the first work item and only freeze telemetry semantics once launch behavior is repeatable      |
