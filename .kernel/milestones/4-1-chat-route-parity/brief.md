# Milestone Brief

## Goal

4.1 — Chat route parity: deliver the native conversation route, message list, core actions, search, archive behavior, and review-overlay behavior matching the current app.

## Target Date

TBD

## Context

This milestone opens the conversation domain in native. It validates chat rendering and route behavior before the shared composer and attachment state are layered on top.

Before this milestone: the native app can host core non-chat surfaces, but conversation flows remain unavailable. After this milestone: the chat route can render and navigate like the Expo app, including its key overlays and state transitions.

## Scope

### In scope

- Chat route and message list rendering
- Conversation actions, search, archive behavior, and review overlay
- Session title updates and core route-state behavior
- Chat data behavior required for route-level parity

### Out of scope

- Shared composer behavior and draft state
- Attachment upload lifecycle and local file state parity

## Acceptance Criteria

This milestone is complete when:

- [ ] The native chat route supports core message rendering and route actions with parity-grade behavior
- [ ] Search, archive, review overlay, and session-title behavior match the current app closely enough for parity review
- [ ] Chat route state is stable enough for the shared composer milestone to build on
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **chat-message-list-and-conversation-actions**: implement the native chat route, message list, and core conversation action behavior.
2. **chat-search-archive-review-overlay-and-title-sync**: implement search, archive behavior, review overlay, and session-title update parity.

## Dependencies

- Phase 3 data-layer and note-handoff outcomes
- Stable protected-shell hosting from Phase 2

## Risks

| Risk                                                      | Impact | Mitigation                                                                |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| Message rendering parity hides deeper session-state drift | High   | Validate route actions and state transitions alongside list rendering     |
| Archive and overlay behavior diverge subtly from Expo     | High   | Verify on device across happy path and state-change cases before sign-off |
