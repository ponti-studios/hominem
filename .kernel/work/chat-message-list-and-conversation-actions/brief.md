# Work Brief

## Goal

Chat message list and conversation action parity

## Context

This work creates the base conversation route in native. It delivers the route, message surface, and core actions that later overlay and composer work require.

## Scope

### In scope

- Chat route and message rendering
- Core conversation actions and route-level state
- Base conversation behavior for later overlay work

### Out of scope

- Search, archive, and review-overlay behavior
- Shared composer and attachment state

## Success Criteria

The work is complete when all of the following are true:

- [ ] The native chat route and message list work with parity-grade correctness
- [ ] Core conversation actions are stable enough for overlay and composer work
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep route and message behavior aligned with current conversation expectations
- Separate base route work from later overlay complexity

## Dependencies

- Phase 3 note and handoff outcomes
- Protected-shell hosting from Phase 2

## Related Work

- Parent: `.kernel/milestones/4-1-chat-route-parity/`
- Blocks: `chat-search-archive-review-overlay-and-title-sync`
- Blocked by: `3-2-notes-parity`
