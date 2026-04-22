# Milestone Plan

## Goal

4.1 — Chat route parity

## Approach

Build the route and message surface first, then layer search, archive, review-overlay, and title-sync behavior on top. This isolates the base conversation route from the more coupled overlay and state-transition behavior.

## Work Item Breakdown

| Work Item                                         | Purpose                                                     | Depends On                                 |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| chat-message-list-and-conversation-actions        | Chat route, message list, and core conversation actions     | none                                       |
| chat-search-archive-review-overlay-and-title-sync | Search, archive behavior, review overlay, and title updates | chat-message-list-and-conversation-actions |

## Critical Path

`chat-message-list-and-conversation-actions` is the bottleneck because overlay and archive behavior depend on a stable route and conversation-state baseline.

## Sequencing Rationale

The base route and message list land first so the conversation host is stable. Search, archive, and overlay behavior follow because they depend on the route and session state already being correct.

## Deliverables

- Native chat route and message list
- Conversation actions, search, archive, and review-overlay parity
- Stable conversation-route behavior for the shared composer milestone

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Core conversation route behavior is verified on device against Expo
- [ ] Overlay and archive behavior are stable enough for daily conversation review

## Risks

| Risk                                                                  | Likelihood | Impact | Mitigation                                                            |
| --------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------- |
| Chat route parity appears correct while session state is inconsistent | Med        | High   | Validate message actions and state transitions directly during review |
| Search and overlay behavior introduce unstable route interactions     | Med        | Med    | Add them only after the base conversation surface is stable           |

## Open Questions

- Which conversation actions must be functional now versus acceptable as parity placeholders? Owner: mobile team. Deadline: before route work exits.
- What review-overlay behavior is required for parity sign-off versus acceptable follow-up detail? Owner: mobile team. Deadline: before milestone review.
