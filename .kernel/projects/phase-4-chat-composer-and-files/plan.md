# Project Plan

## Goal

Phase 4 — Chat, Composer, and Files

## Approach

Port the conversation domain in three slices: chat route and message behavior first, the shared composer second, then attachment and upload parity third. The composer is treated as its own module with explicit boundaries rather than as a side effect of the tab shell.

The core bet is that the shared composer is the highest-risk coupling point in the app. Its rules must be made explicit and proven across inbox, notes, and chat before file behavior is considered complete.

## Milestone Breakdown

| Milestone | Purpose                                                                         | Depends On                       | Target Date |
| --------- | ------------------------------------------------------------------------------- | -------------------------------- | ----------- |
| 4.1       | Port chat route, message actions, archive behavior, and review overlay flow     | phase-3-inbox-notes-and-settings | TBD         |
| 4.2       | Port the shared composer with route-aware behavior, mentions, and draft restore | 4.1                              | TBD         |
| 4.3       | Port upload lifecycle and attachment flows for notes and chat insertion         | 4.2                              | TBD         |

## Critical Path

Milestone 4.2 is the bottleneck. Chat rendering alone is not enough to restore the main conversation workflow; the shared composer governs cross-route behavior, draft lifetime, and action semantics that other surfaces depend on.

## Sequencing Rationale

Chat route parity starts first so message rendering, search, and archive behavior are stable. The shared composer follows because it depends on those route and state assumptions and introduces the highest coupling across the app. Attachments and upload behavior close the phase because they require both the conversation surface and the shared composer host to be stable.

## Risks

| Risk                                                                                                   | Likelihood | Impact | Mitigation                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| The shared single-instance composer is more tightly coupled to the shell than the surface map suggests | High       | High   | Treat composer responsibilities as a documented module boundary before 4.2 implementation expands                        |
| Streaming and optimistic updates create subtle state regressions                                       | Med        | High   | Validate message state transitions against recorded Expo behavior and inspect cache invalidation paths before 4.1 closes |
| Attachment state drifts between notes and chat if the native model is oversimplified                   | Med        | High   | Reuse one attachment state model and verify insertion, removal, and recovery across both hosts before 4.3 exits          |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] Daily conversation workflows run entirely in native without Expo fallback
- [ ] Shared composer behavior is consistent across inbox, notes, and chat
- [ ] Attachment and draft flows are verified on device and survive route transitions

## Open Questions

- What is the exact native abstraction boundary between chat state, composer state, and route state? Owner: mobile team. Deadline: before 4.2 exits.
- How should optimistic updates and streaming responses be reconciled in the native data layer? Owner: mobile team. Deadline: before 4.1 exits.
- Which attachment lifecycle events must be observable for debugging and rollout gating? Owner: mobile team. Deadline: before 4.3 exits.
