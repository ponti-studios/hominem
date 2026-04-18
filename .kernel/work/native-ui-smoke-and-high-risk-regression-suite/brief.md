# Work Brief

## Goal

Native UI smoke and high-risk regression suite

## Context

This work adds the host-level and device-level smoke coverage needed to catch the migration failures unit tests cannot. It focuses on the flows most likely to block rollout or cutover.

## Scope

### In scope

- UI smoke coverage for critical flows
- High-risk regression checks for native host and device behavior
- Smoke coverage aligned to rollout gating

### Out of scope

- Logic-level unit and integration coverage
- Rollout execution itself

## Success Criteria

The work is complete when all of the following are true:

- [ ] Critical UI and high-risk host behaviors have usable smoke or regression protection
- [ ] Smoke coverage is stable enough to be trusted during rollout
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep the suite narrow enough to avoid flake-heavy coverage
- Prioritize the highest operational risks over exhaustive UI breadth

## Dependencies

- `native-unit-and-integration-regression-suite`
- Stable migrated hosts and device behaviors from earlier phases

## Related Work

- Parent: `.kernel/milestones/6-1-test-and-regression-parity/`
- Blocks: `rollout-gates-dashboards-and-rollback-runbooks`
- Blocked by: `native-unit-and-integration-regression-suite`
