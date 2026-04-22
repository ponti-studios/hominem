# Project Plan

## Goal

Phase 3 — Inbox, Notes, and Settings

## Approach

Establish the reusable native data layer through real product surfaces rather than isolated infrastructure. Inbox goes first because it validates fetch, refresh, and scroll restoration; notes goes second because it exercises edit and autosave behavior; settings goes third because it consolidates account and device-preference surfaces on top of the same shell and auth context.

The core bet is that the data-layer contract should be proven through daily-use surfaces before the higher-coupling chat and composer work begins.

## Milestone Breakdown

| Milestone | Purpose                                                                          | Depends On             | Target Date |
| --------- | -------------------------------------------------------------------------------- | ---------------------- | ----------- |
| 3.1       | Validate the native data layer through inbox parity and top-anchor restoration   | phase-2-auth-and-shell | TBD         |
| 3.2       | Ship notes list and detail parity with autosave and note-to-chat handoff         | 3.1                    | TBD         |
| 3.3       | Ship settings and archived-session parity on the same shell and data foundations | 3.2                    | TBD         |

## Critical Path

Milestone 3.1 is the bottleneck because it proves the fetch, cache, invalidation, and scroll-restoration rules that the later milestones build on. If inbox parity is unstable, notes and chat will inherit the same instability.

## Sequencing Rationale

Inbox is first because it exercises list refresh and anchoring under real data. Notes follows because it adds create, edit, detach, and autosave semantics to the same core state model. Settings comes last because it depends on the auth context from Phase 2 and must stay aligned with both earlier auth decisions and later device-feature work.

## Risks

| Risk                                                                                        | Likelihood | Impact | Mitigation                                                                                             |
| ------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Scroll anchoring parity is harder in native lists than in the current React implementation  | Med        | High   | Validate top-anchor restoration on real devices before considering 3.1 complete                        |
| Notes autosave semantics drift if native save triggers are oversimplified                   | Med        | High   | Preserve explicit save conditions and verify edit, background, and navigation cases before closing 3.2 |
| Settings hides dependencies on auth and device-feature behavior that later phases can break | Med        | Med    | Treat settings surfaces as integration tests for auth and device-preference contracts                  |

## Acceptance Criteria

This project is complete when:

- [ ] All milestones are done
- [ ] Inbox, notes, and settings are usable daily in the native app without Expo fallback
- [ ] The data layer is stable enough for conversation and composer work
- [ ] Real-device verification exists for feed anchoring, notes editing, and archived-session behavior

## Open Questions

- Which native cache and observation model should back inbox and notes while staying friendly to later chat work? Owner: mobile team. Deadline: before 3.1 exits.
- What exact conflict behavior is expected if notes autosave collides with backgrounding or route transitions? Owner: mobile team. Deadline: before 3.2 exits.
- Does archived-session behavior require any additional server or local-state contract that is not yet captured in Phase 0? Owner: mobile team. Deadline: before 3.3 exits.
