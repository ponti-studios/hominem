# Milestone Brief

## Goal

6.2 — Parallel run and rollout proof: define rollout gates, dashboards, and rollback plans, then run the native app alongside Expo for internal and staged external users.

## Target Date

TBD

## Context

This milestone turns parity into production evidence. It pairs explicit operational gates with a real dual-run period so cutover is based on observed behavior rather than confidence alone.

Before this milestone: the native app may be feature-complete and tested, but it has not yet proven itself under real rollout conditions. After this milestone: the team has rollout evidence, thresholds, rollback readiness, and a recorded cutover recommendation grounded in actual use.

## Scope

### In scope

- Rollout gates, dashboards, and rollback runbooks
- Internal and staged external dual-run execution
- Monitoring of launch, auth, inbox, notes, chat, media, and Apple-surface stability
- Evidence needed to decide whether cutover is safe

### Out of scope

- Permanent retirement of Expo release obligations
- Net-new feature work unrelated to rollout validation

## Acceptance Criteria

This milestone is complete when:

- [ ] Rollout gates and rollback plans are explicit, documented, and exercised
- [ ] The native app proves stable enough in the dual-run period across the agreed user cohorts
- [ ] Operational evidence is sufficient to support a cutover decision
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **rollout-gates-dashboards-and-rollback-runbooks**: define rollout gates, dashboards, thresholds, and rollback procedures.
2. **internal-and-staged-external-parallel-run**: execute the internal and staged external dual-run and collect decision-grade evidence.

## Ownership

- DRI: engineering leadership
- Rollout approval: product leadership and engineering leadership
- Operational execution: mobile team

## Dependencies

- Milestone 6.1 automated coverage
- Stable telemetry and device behavior from Phase 5

## Risks

| Risk                                         | Impact | Mitigation                                                                       |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Gates are too vague to block a risky cutover | High   | Define explicit metrics, thresholds, and rollback triggers before rollout starts |
| Dual-run evidence is noisy or incomplete     | High   | Constrain cohorts, signals, and review cadence before the run begins             |
