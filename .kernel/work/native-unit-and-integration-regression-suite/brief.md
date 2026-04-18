# Work Brief

## Goal

Native unit and integration regression suite

## Context

This work creates the logic-level safety net for the migration. It focuses on the critical flows and shared logic that must stay stable regardless of UI or rollout environment.

## Scope

### In scope

- Unit coverage for shared and critical logic
- Integration coverage for key migrated flows
- Test coverage aligned to rollout-critical parity surfaces

### Out of scope

- UI smoke or high-risk host behavior
- Rollout execution and cutover operations

## Success Criteria

The work is complete when all of the following are true:

- [ ] Critical logic and migrated flows have the right unit and integration coverage
- [ ] The suite is stable enough to act as a release guardrail
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Map coverage to the parity matrix and rollout risk, not just code ownership
- Keep the suite maintainable enough to survive ongoing rollout work

## Dependencies

- Stable migrated flows from Phases 1 through 5
- Existing test inventory and risk map

## Related Work

- Parent: `.kernel/milestones/6-1-test-and-regression-parity/`
- Blocks: `native-ui-smoke-and-high-risk-regression-suite`
- Blocked by: `phase-5-device-features-and-apple-integrations`
