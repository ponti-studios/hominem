# Milestone Brief

## Goal

3.1 — Inbox parity: deliver the native inbox route, feed refresh behavior, and top-anchor restoration needed for the app's primary browse loop.

## Target Date

TBD

## Context

This milestone is the first daily-use surface in the native app. It validates the early native data layer against a real, high-frequency screen before notes, settings, and chat depend on the same state patterns.

Before this milestone: the protected shell exists, but the inbox surface is still placeholder-level. After this milestone: the native inbox can fetch, refresh, restore scroll context, and behave like the Expo feed in day-to-day use.

## Scope

### In scope

- Native inbox route and feed components
- Refresh model and feed invalidation behavior
- Top-anchor restoration and scroll-context preservation
- Native data and cache behavior required by the inbox surface

### Out of scope

- Notes, settings, and archived-session product surfaces
- Chat, composer, and upload flows

## Acceptance Criteria

This milestone is complete when:

- [ ] The native inbox route matches the Expo app's feed and refresh behavior on device
- [ ] Top-anchor restoration behaves correctly across reload and navigation cases
- [ ] The native data layer is stable enough for later note and chat work to build on
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-inbox-feed-refresh-parity**: implement the inbox route, feed rendering, refresh logic, and the data-layer behavior it depends on.
2. **top-anchor-scroll-restoration-and-inbox-sync**: implement top-anchor restoration, scroll context preservation, and inbox state synchronization across updates.

## Dependencies

- Phase 2 protected shell and auth context
- Stable data-client foundation from Phase 1

## Risks

| Risk                                                  | Impact | Mitigation                                                                  |
| ----------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Feed refresh and cache invalidation diverge from Expo | High   | Validate refresh behavior under repeated reload and state update conditions |
| Top-anchor restoration is unstable on native lists    | High   | Verify real-device scroll restoration before closing the milestone          |
