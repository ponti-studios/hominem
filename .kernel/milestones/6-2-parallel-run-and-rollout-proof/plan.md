# Milestone Plan

## Goal

6.2 — Parallel run and rollout proof

## Approach

Define operational gates and dashboards while 6.1 is finishing, then execute the dual-run period only after the native test suite and telemetry are stable enough to act as real guardrails. This prevents the rollout from becoming an unstructured soak without clear pass or fail criteria.

## Work Item Breakdown

| Work Item                                      | Purpose                                             | Depends On                                           |
| ---------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| rollout-gates-dashboards-and-rollback-runbooks | Explicit thresholds, dashboards, and rollback plans | Stable telemetry definitions and 6.1 risk map        |
| internal-and-staged-external-parallel-run      | Dual-run execution and evidence collection          | Approved gates, stable telemetry, and 6.1 guardrails |

## Critical Path

`rollout-gates-dashboards-and-rollback-runbooks` is the bottleneck because the parallel run is not decision-useful until its success and rollback criteria are defined and tied to stable signals.

## Sequencing Rationale

Operational rules land first so the dual run has a clear contract. Evidence collection follows only after the team knows what signals matter, what threshold constitutes success or rollback, and which automated checks are stable enough to back those decisions.

## Deliverables

- Rollout gates, dashboards, and rollback runbooks
- Internal and staged external dual-run evidence
- A cutover recommendation grounded in explicit operational criteria

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] The team can state clearly whether cutover should proceed and why
- [ ] A cutover recommendation is recorded with the supporting evidence
- [ ] Rollback procedures have been documented and exercised

## Risks

| Risk                                                             | Likelihood | Impact | Mitigation                                                                |
| ---------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------- |
| The parallel run starts before metrics and thresholds are agreed | Med        | High   | Block rollout execution until gates and dashboards are approved           |
| Evidence collection misses key parity regressions                | Med        | High   | Tie dashboards and review cadence to the highest-risk surfaces explicitly |

## Open Questions

- Which user cohorts must participate for the rollout evidence to count as sufficient? Owner: product leadership. Deadline: before the dual run starts.
- Which rollback triggers are hard blockers versus watch items? Owner: engineering leadership. Deadline: before milestone review.
