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

- A native root app container that can render placeholder screens for all major top-level app destinations
- Deep-link and native-intent routing that resolves the supported URL patterns into placeholder routes
- PostHog lifecycle events, startup instrumentation, and crash reporting configured across app variants
- A stable shell that Phase 2 can use for auth, onboarding, and protected-route delivery

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Deep links and native-intent entry paths resolve correctly on device against the placeholder shell
- [ ] Launch instrumentation, analytics tagging, and crash reporting are verified for each variant

## Risks

| Risk                                                                    | Likelihood | Impact | Mitigation                                                                                       |
| ----------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| Routing and intent entry grow separate codepaths                        | Med        | High   | Keep one central routing layer and treat native intent entry as an adapter into it               |
| Variant analytics config drifts from build configuration                | Med        | High   | Validate event tagging and DSN selection explicitly in each variant before closing the milestone |
| Placeholder shell hides launch-state regressions until auth work begins | Med        | Med    | Include explicit launch and fallback verification in the router work item's acceptance criteria  |

## Open Questions

- What exact set of placeholder routes must exist now versus waiting for Phase 2 route ownership? Owner: mobile team. Deadline: before router work exits.
- Are existing Expo analytics event names reused exactly or normalized during native instrumentation? Owner: mobile team. Deadline: before observability work exits.
