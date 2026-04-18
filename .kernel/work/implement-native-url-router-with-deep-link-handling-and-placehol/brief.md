# Work Brief

## Goal

Implement native URL router with deep-link handling and placeholder route shells

## Context

This work creates the first real runtime shell for the native app. Without it, later phases have no stable place to land auth, protected, notes, chat, settings, error, and not-found routes, and launch entry paths cannot be compared against the Expo app.

Current state: the native foundation can build and render primitives, but it does not yet provide a single root container, placeholder destinations, or deep-link and native-intent handling.

When this work is done: the native app launches into a root container, placeholder screens exist for all major top-level destinations, and both supported URLs and native intents flow through one routing layer.

## Scope

### In scope

- Root app container and placeholder route shells for public auth, protected app, notes, chat, settings, error, and not-found states
- Deep-link parser and route mapping for supported `hakumi://` and `https://hakumi.app/` paths
- Native-intent entry bridge that hands off into the same router used by standard deep links
- Minimal route metadata and fallback behavior needed for later Phase 2 shell work

### Out of scope

- Auth session restore, onboarding logic, and protected-route gating semantics beyond placeholder routing
- Analytics, crash reporting, and startup instrumentation
- Product-surface parity inside the placeholder routes

## Success Criteria

The work is complete when all of the following are true:

- [ ] The native app launches into a root container that can render placeholder destinations for every major top-level route family in the parity matrix
- [ ] Supported `hakumi://` and `https://hakumi.app/` paths resolve into the correct placeholder destinations on device without crashes
- [ ] Native-intent entry paths are translated into the same route model as standard deep links
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

<!-- Each criterion must be testable. "It works" is not a criterion. -->
<!-- "A user can submit the form and see a confirmation message" is. -->

## Constraints

- Use one routing layer for launch, deep links, and native-intent entry rather than parallel codepaths
- Keep placeholder screens intentionally minimal so later phases can replace them without structural churn
- Preserve the current app's route vocabulary and fallback expectations unless explicitly documented otherwise

## Dependencies

- Milestone 1.1 app bootstrap, variants, and design system work
- Stable list of top-level destinations from the Swift migration parity docs
- URL schemes and associated-domain expectations from the current Expo app

## Related Work

- Parent: `.kernel/milestones/1-2-routing-shell-deep-links-and-observability/`
- Blocks: `wire-posthog-analytics-startup-instrumentation-and-crash-reporti`
- Blocked by: `1-1-app-bootstrap-variants-and-design-system`
