# Work Brief

## Goal

Internal and staged external parallel run

## Context

This work executes the dual-run period that proves whether the native app is safe to cut over. It is where rollout gates meet real user and operational behavior.

## Scope

### In scope

- Internal dual-run execution
- Staged external rollout execution
- Evidence collection against the agreed rollout gates

### Out of scope

- Gate definition and dashboard creation
- Final retirement of Expo release obligations

## Success Criteria

The work is complete when all of the following are true:

- [ ] The dual-run period produces decision-grade evidence across the agreed cohorts
- [ ] Observed behavior meets or fails the explicit rollout gates clearly enough to drive a cutover decision
- [ ] A cutover recommendation is recorded with the supporting evidence
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Follow the approved gates and rollback rules rather than improvising during rollout
- Keep cohort size and evidence collection aligned with the agreed rollout plan

## Dependencies

- `rollout-gates-dashboards-and-rollback-runbooks`
- `6-1-test-and-regression-parity`
- Approved rollout cohorts and review cadence

## Related Work

- Parent: `.kernel/milestones/6-2-parallel-run-and-rollout-proof/`
- Blocks: `native-release-automation-replaces-expo-lanes`
- Blocked by: `rollout-gates-dashboards-and-rollback-runbooks`
