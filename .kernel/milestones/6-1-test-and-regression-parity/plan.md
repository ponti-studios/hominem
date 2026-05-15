# Milestone Plan

## Goal

6.1 — Test and regression parity

## Approach

Build unit and integration coverage first, then layer UI smoke and high-risk regression checks on top. Test design and harness work for UI smoke can start while the lower layers are stabilizing, but rollout gating should not depend on smoke coverage until the logic-layer suite is dependable.

## Work Item Breakdown

| Work Item                                      | Purpose                                                                 | Depends On                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| native-unit-and-integration-regression-suite   | Unit and integration coverage for critical migrated flows               | none                                           |
| native-ui-smoke-and-high-risk-regression-suite | UI smoke and high-risk regression coverage for host and device behavior | Stable native test harness and agreed risk map |

## Critical Path

`native-unit-and-integration-regression-suite` is the bottleneck because higher-level smoke coverage is only useful once the core logic has stable test scaffolding and a trustworthy failure signal.

## Sequencing Rationale

Logic-layer coverage comes first because it protects shared rules and reduces debugging noise. UI smoke and high-risk regressions can be designed in parallel, but they should only become rollout gates once the lower layers already catch the most common failures.

## Deliverables

- Native unit and integration suite for critical flows
- Focused UI smoke and regression coverage for high-risk surfaces
- Automated guardrails suitable for later rollout and cutover decisions

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Native automated coverage protects the agreed critical and high-risk flows
- [ ] The regression suite is stable enough to support rollout gating

## Risks

| Risk                                          | Likelihood | Impact | Mitigation                                                       |
| --------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| The suite grows broad but not decision-useful | Med        | High   | Map coverage to rollout risks and parity obligations explicitly  |
| UI smoke checks are too flaky for real gating | Med        | High   | Keep them focused and stabilize before treating them as blockers |

## Open Questions

- Which native-only behaviors must have dedicated regression coverage before rollout? Owner: engineering leadership and mobile team. Deadline: before milestone review.
- What flake threshold is acceptable for UI smoke tests to count as a release gate? Owner: engineering leadership. Deadline: before smoke work exits.
