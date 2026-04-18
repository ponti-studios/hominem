# Work Brief

## Goal

Control Center widget routing and target integration parity

## Context

This work finishes the Apple integration layer by wiring the widget and its target configuration into the same route and shared-data contract established for intents and shortcuts. Implementation can begin once that contract is drafted, but sign-off depends on the contract remaining stable through cross-variant validation.

## Scope

### In scope

- Control Center widget routing behavior
- Target integration and variant-safe wiring
- Extension behavior tied to the shared-data contract

### Out of scope

- Core app-intent contract definition already covered by the prior work item
- Phase 6 rollout and cutover behavior

## Success Criteria

The work is complete when all of the following are true:

- [ ] Widget routing opens the correct native destinations with parity-grade behavior
- [ ] Widget and extension target integration work across required variants
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep widget routing aligned with the same destination contract as the main app and app intents
- Validate variant and entitlement behavior explicitly instead of assuming one target setup generalizes

## Dependencies

- Stable app-group contract and destination vocabulary from the app-intents work
- Current widget and target behavior from the existing native code and Expo integration

## Related Work

- Parent: `.kernel/milestones/5-3-apple-integration-parity/`
- Blocks: `5-3-apple-integration-parity`
- Blocked by: `app-intents-shortcut-donation-and-app-groups`
