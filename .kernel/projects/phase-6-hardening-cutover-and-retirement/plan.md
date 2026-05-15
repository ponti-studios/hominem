# Project Plan

## Goal

Phase 6 — Hardening, Cutover, and Retirement

## Approach

Run cutover in three steps: rebuild and validate native test coverage, define gates and execute a dual-run rollout with clear thresholds and rollback paths, then promote the native release path and retire Expo only after the native client proves stable through an agreed observation window. This phase treats operational evidence as the release gate rather than assuming feature completion is enough.

The core bet is that a disciplined parallel run reduces the risk of discovering parity gaps only after native becomes the sole supported client.

## Milestone Breakdown

| Milestone | Purpose                                                                                                              | Depends On                                     | Target Date |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------- |
| 6.1       | Establish native regression, smoke, and rollout validation coverage for critical flows                               | phase-5-device-features-and-apple-integrations | TBD         |
| 6.2       | Define rollout gates and execute internal and staged external parallel run with agreed thresholds and rollback paths | Stable 6.1 guardrails and Phase 5 telemetry    | TBD         |
| 6.3       | Complete cutover, observation-window review, Expo release retirement, and operational ownership transfer             | 6.2 cutover recommendation and approval        | TBD         |

## Critical Path

Milestone 6.2 is the bottleneck. Test coverage reduces risk, but only a parallel run reveals whether the native app behaves correctly under real-user conditions across launch, auth, messaging, media, and Apple-platform flows.

## Sequencing Rationale

Validation coverage comes first so the rollout has automated guardrails. Gate definition and rollout preparation can begin while 6.1 is stabilizing, but the dual run only starts once those guardrails are trustworthy. Expo retirement comes last because it is destructive and must remain reversible until thresholds are met and the post-cutover observation window closes.

## Risks

| Risk                                                                                          | Likelihood | Impact | Mitigation                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| Rollout gates are underdefined and allow subjective cutover decisions                         | Med        | High   | Set explicit crash, latency, and parity thresholds before 6.2 starts                             |
| Native-only regressions appear only under real-user load                                      | Med        | High   | Keep rollback available during 6.2 and monitor high-risk flows with focused telemetry dashboards |
| Expo retirement removes a safety net before documentation and ownership transfer are complete | Low        | High   | Make 6.3 contingent on completed runbooks, release-lane shutdown steps, and ownership sign-off   |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] Rollout gates and rollback procedures are documented and exercised
- [ ] The native app is the supported iOS client with no unsupported parity gaps
- [ ] Expo retirement tasks and ownership transfer are complete

## Open Questions

- What exact crash-free, startup, and behavioral thresholds define rollout readiness? Owner: product and engineering leadership. Deadline: before 6.2 starts.
- How long should the dual-run period last, and which user cohorts must participate? Owner: product leadership. Deadline: before 6.2 starts.
- Should the Expo client be deleted from the monorepo or archived behind a clear boundary after cutover? Owner: engineering leadership. Deadline: before 6.3 exits.
