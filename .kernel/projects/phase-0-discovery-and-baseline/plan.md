# Project Plan

## Goal

Phase 0 — Discovery and Baseline

## Approach

Treat the existing migration docs as the canonical seed and formalize them into an accepted parity baseline. Delivery proceeds in three steps: freeze the surface inventory, freeze the contracts and architecture assumptions, then capture baseline evidence and governance rules for later phase exits.

The core bet is that strong discovery reduces downstream rework more than early implementation speed would. This phase intentionally prioritizes clarity about what must remain stable over how the native implementation will be built.

## Milestone Breakdown

| Milestone | Purpose                                                                                             | Depends On | Target Date |
| --------- | --------------------------------------------------------------------------------------------------- | ---------- | ----------- |
| 0.1       | Approve the complete surface inventory and phase assignment                                         | none       | TBD         |
| 0.2       | Freeze API, auth, deep-link, analytics, storage, and release contracts; record architecture choices | 0.1        | TBD         |
| 0.3       | Capture baseline evidence and define phase-exit governance and dual-run acceptance                  | 0.2        | TBD         |

## Critical Path

Milestone 0.1 is the bottleneck. If the migration surface is incomplete, every later phase can ship apparent parity while still missing user-visible behavior. Milestone 0.2 is the second bottleneck because implementation cannot be judged against drifting contracts.

## Sequencing Rationale

Scope freeze comes first so the migration has a fixed denominator. Contract freeze comes second because parity cannot be verified while auth, storage, or analytics semantics are still ambiguous. Baseline evidence and governance come last because they depend on knowing both what is in scope and what exact behavior must be preserved.

## Risks

| Risk                                                                                       | Likelihood | Impact | Mitigation                                                                                           |
| ------------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Hidden dependencies between shared composer and route shell are missing from the inventory | Med        | High   | Reconcile the surface inventory against both route entry points and composer docs before closing 0.1 |
| Auth recovery behavior is underdocumented in the current boot sequence                     | High       | High   | Capture explicit signed-out, expired-session, and partial-profile scenarios during 0.2               |
| Native targets drift across main app, intents, and widget before contracts are frozen      | Med        | High   | Include entitlements, app groups, and widget routing in the Phase 0 contract inventory               |
| Media and app-intent parity lacks baseline evidence                                        | Med        | Med    | Require device-level recordings or logs for media, intent, and widget flows before closing 0.3       |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] The surface inventory and parity matrix are accepted as complete
- [ ] Contract freeze and baseline evidence exist for all high-risk surfaces
- [ ] Governance for later phase exits is documented

## Open Questions

- What exact artifact format is required for per-surface parity evidence: screenshots only, or screenshots plus event logs and video? Owner: mobile team. Deadline: before 0.3 exits.
- Which architecture decisions must be finalized in Phase 0 versus deferred to implementation spikes in Phase 1? Owner: mobile team lead. Deadline: before 0.2 exits.
- Who signs off each phase exit during the dual-run period? Owner: product and engineering leadership. Deadline: before Phase 1 execution expands.
