# Milestone Plan

## Goal

1.2 — Routing shell, deep links, and observability

## Approach

Ship the routing shell first, then instrument it. The first work item establishes the native app container, placeholder destinations, and deep-link resolution path that all later telemetry and crash reporting will observe. Once launch and routing are stable, the second work item wires PostHog, startup metrics, and crash reporting with per-variant configuration.

The key design decision is to keep every launch entry path flowing through one routing layer rather than having separate codepaths for app launch, deep links, and native intents.

## Work Item Breakdown

<!-- List each work item, what it delivers, and any prerequisite work items. -->

| Work Item                                                        | Purpose                                                                                   | Depends On                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| implement-native-url-router-with-deep-link-handling-and-placehol | Root app container, placeholder route shells, deep-link parser, and native-intent handoff | none                                                             |
| wire-posthog-analytics-startup-instrumentation-and-crash-reporti | Lifecycle analytics, startup tracing, and crash reporting wired to the root shell         | implement-native-url-router-with-deep-link-handling-and-placehol |

## Critical Path

`implement-native-url-router-with-deep-link-handling-and-placehol` is the bottleneck. Until the native app has a single root shell and routing layer, observability work cannot reliably measure real launch, deep-link, or fallback behavior.

## Sequencing Rationale

The first work item creates the runtime shape of the app: where launch lands, how placeholders are reached, and how URLs are parsed. That unlocks the second work item because analytics and crash reporting need a stable lifecycle and route surface to instrument. The final work item cannot begin meaningfully until the routing layer has stopped moving.

## Deliverables

- `Router` (`@Observable @MainActor`) — single source of truth for `AuthPhase`, auth path, protected path, selected tab, and pending deep-link buffer
- `DeepLinkParser` — resolves `hakumi://` and `https://hakumi.app/` URLs into typed `AppRoute` values
- `RootView` — switches on `AuthPhase`; each tab owns its own `NavigationStack`; `.onOpenURL` wired through `Router`
- Placeholder screens for all 11 route families (auth sign-in, verify OTP, onboarding, inbox, notes list, note detail, chat, settings, archived chats, error, not-found)
- `Observability` facade + `StartupMetrics` — PostHog iOS SDK v3.54.0 via SPM; disabled in dev/e2e via empty `POSTHOG_API_KEY` build setting; `app_startup_baseline` event emitted on shell ready
- `appLifecycleObserver()` modifier — flushes PostHog on background scene phase

## Acceptance Criteria

This milestone is complete when:

- [x] All work items are done
- [x] `RootView` renders correct placeholder for every auth phase (booting spinner → unauthenticated → authenticated tabs)
- [x] `DeepLinkParser` resolves all supported `hakumi://` paths into typed routes
- [x] PostHog SDK resolves via SPM; disabled in debug builds (empty key); startup baseline event fires on shell ready
- [x] Build clean across all 4 schemes

## Risks (resolved)

| Risk | Outcome |
|------|---------|
| Routing and intent entry grow separate codepaths | Resolved — single `Router` handles launch, deep links, and native intent |
| Variant analytics config drifts from build configuration | Resolved — `POSTHOG_API_KEY` injected from build settings per config |

## Open Questions (resolved)

- **Placeholder routes**: All 11 route families implemented as `PlaceholderScreen` wrappers. Phase 2 replaces each call site.
- **Analytics event names**: Expo names reused verbatim (`app_startup_baseline`, phase keys match `startup-metrics.ts`).
- **Architecture pattern**: `@Observable` + async/await chosen. Closed.
