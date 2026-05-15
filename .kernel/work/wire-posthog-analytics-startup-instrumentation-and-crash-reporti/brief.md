# Work Brief

## Goal

Wire PostHog analytics, startup instrumentation, and crash reporting

## Context

This work makes the native shell observable before any product surfaces are ported. Without it, later parity claims would have no trustworthy launch, lifecycle, crash, or startup baseline to compare against the Expo app.

Current state: the app can build and the routing shell can exist, but analytics, startup instrumentation, and crash reporting are not yet wired into the native lifecycle.

When this work is done: launch and lifecycle events are emitted with correct variant tagging, startup metrics are recorded, and crash reporting is configured per variant so later phases can use the same telemetry foundation.

## Scope

### In scope

- PostHog lifecycle events for launch, background, and other core app transitions used by the migration baseline
- Startup instrumentation for cold start and early app readiness timing
- Crash reporting configuration per variant with testable routing to the correct project or DSN
- Variant-aware environment plumbing for telemetry keys and release identifiers

### Out of scope

- Product-surface analytics beyond app lifecycle and startup baselines
- Routing-layer implementation itself
- Notification, review-prompt, or device-feature telemetry that belongs to later phases

## Success Criteria

The work is complete when all of the following are true:

- [ ] PostHog receives launch and lifecycle events from the native app with correct variant tagging
- [ ] Cold-start instrumentation records the agreed startup metrics on device for the native shell
- [ ] Crash reporting is configured per variant and a test crash can be routed to the expected project or DSN
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

<!-- Each criterion must be testable. "It works" is not a criterion. -->
<!-- "A user can submit the form and see a confirmation message" is. -->

## Constraints

- Preserve event names and core lifecycle semantics unless an explicit migration decision changes them
- Telemetry must be variant-aware so preview, e2e, and production baselines do not contaminate each other
- Startup instrumentation should attach to the real app lifecycle, not placeholder callbacks that later phases will delete

## Dependencies

- The native root shell and router must exist so launch and route lifecycle are stable enough to instrument
- Variant environment configuration from Milestone 1.1 must supply the correct telemetry keys and release metadata
- Existing Expo lifecycle event taxonomy must be available as the reference baseline

## Related Work

- Parent: `.kernel/milestones/1-2-routing-shell-deep-links-and-observability/`
- Blocks: `phase-2-auth-and-shell`
- Blocked by: `implement-native-url-router-with-deep-link-handling-and-placehol`
