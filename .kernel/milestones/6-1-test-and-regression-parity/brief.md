# Milestone Brief

## Goal

6.1 — Test and regression parity: establish native unit, integration, UI smoke, and high-risk regression coverage for the critical migrated flows.

## Target Date

TBD

## Context

This milestone creates the automated safety net for rollout. It must cover both the critical flows protected by existing mobile tests and the high-risk native-only behaviors introduced by the migration.

Before this milestone: parity may exist functionally, but rollout confidence depends heavily on manual verification. After this milestone: the native app has a focused regression suite that can guard cutover decisions.

## Scope

### In scope

- Native unit and integration coverage for critical migrated flows
- Native UI smoke and high-risk regression coverage
- Test coverage for media and Apple-surface behaviors where risk justifies it
- Coverage needed for rollout and cutover decisions

### Out of scope

- Parallel run execution and rollout gating
- Release-lane shutdown and Expo retirement work

## Acceptance Criteria

This milestone is complete when:

- [ ] Critical migrated flows are covered by native automated tests at the right layer
- [ ] High-risk native-only behaviors have smoke or regression protection suitable for rollout gating
- [ ] The test suite is stable enough to serve as a cutover guardrail in later milestones
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-unit-and-integration-regression-suite**: build the native unit and integration suite for critical flows and shared logic.
2. **native-ui-smoke-and-high-risk-regression-suite**: build native UI smoke and high-risk regression coverage for host and device behaviors.

## Ownership

- DRI: mobile team
- Release-gate sign-off: engineering leadership
- Scope sign-off: product leadership for any newly required regression coverage beyond the parity matrix

## Dependencies

- Phases 1 through 5 complete enough that critical flows are stable
- Existing Expo test inventory and risk map from earlier planning

## Risks

| Risk                                                         | Impact | Mitigation                                                                    |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------- |
| Coverage looks broad but misses the real rollout risks       | High   | Map tests directly to the parity matrix and high-risk migration surfaces      |
| UI smoke coverage is too brittle to be useful during rollout | High   | Keep smoke flows focused on critical paths and stabilize them before sign-off |
