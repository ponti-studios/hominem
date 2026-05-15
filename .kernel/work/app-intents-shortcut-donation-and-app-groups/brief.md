# Work Brief

## Goal

App intents, shortcut donation, and app-group parity

## Context

This work creates the system-facing contract shared by the native app and Apple-platform entry points. It must line up with the same route and shared-data model the main app uses, and it can begin once route and entitlement contracts are stable rather than waiting for all of Milestone 5.2 to close.

## Scope

### In scope

- App intents and shortcut donation behavior
- Shared app-group coordination
- System-entry mapping into app destinations

### Out of scope

- Control Center widget UI and target integration
- Phase 6 rollout and cutover work

## Success Criteria

The work is complete when all of the following are true:

- [ ] App intents and shortcut donation route into the correct destinations with parity-grade behavior
- [ ] App-group coordination is explicit and stable enough for widget and extension work
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep system-entry destinations aligned with the main app's route vocabulary
- Make the shared-data contract explicit before widget work layers on top

## Dependencies

- Stable native route destinations from earlier phases
- Variant and entitlement foundations from Phase 1

## Related Work

- Parent: `.kernel/milestones/5-3-apple-integration-parity/`
- Blocks: `control-center-widget-routing-and-target-integration`
- Blocked by: `phase-1-native-foundation`
