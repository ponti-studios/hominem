# Milestone Plan

## Goal

3.1 — Inbox parity

## Approach

Ship feed rendering and refresh behavior first, then stabilize top-anchor restoration on top of the same state model. This keeps the milestone anchored in actual daily-use behavior instead of infrastructure in isolation.

## Work Item Breakdown

| Work Item                                    | Purpose                                                                 | Depends On                       |
| -------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- |
| native-inbox-feed-refresh-parity             | Inbox route, feed rendering, refresh logic, and base data behavior      | none                             |
| top-anchor-scroll-restoration-and-inbox-sync | Top-anchor restoration, scroll preservation, and update synchronization | native-inbox-feed-refresh-parity |

## Critical Path

`native-inbox-feed-refresh-parity` is the bottleneck because scroll restoration only matters once feed rendering and refresh behavior are already correct.

## Sequencing Rationale

The route, feed, and refresh model come first because they define the surface users see most often. Top-anchor restoration follows as the highest-risk native behavior layered on top of that stable feed state.

## Deliverables

- Native inbox route with refresh and state invalidation behavior
- Scroll restoration and top-anchor parity on real devices
- Inbox-ready data-layer patterns for later phases

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Feed refresh and scroll restoration behave like Expo on device
- [ ] The inbox surface is stable enough for daily-use review

## Risks

| Risk                                                                  | Likelihood | Impact | Mitigation                                                           |
| --------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Native list behavior does not support parity-grade anchor restoration | Med        | High   | Prototype and verify the anchor model early in the second work item  |
| Feed updates cause inconsistent scroll state under live changes       | Med        | High   | Validate state sync under reload and update scenarios before closure |

## Open Questions

- Which scroll-restoration cases are required for parity versus acceptable follow-up work? Owner: mobile team. Deadline: before anchor-restoration work exits.
- What is the minimum acceptable refresh latency or smoothness for parity sign-off? Owner: mobile team. Deadline: before milestone review.
