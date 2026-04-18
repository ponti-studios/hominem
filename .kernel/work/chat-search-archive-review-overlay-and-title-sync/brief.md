# Work Brief

## Goal

Chat search, archive, overlay, and title sync parity

## Context

This work adds the route-level behaviors that make conversation flows production-like: search, archive, review-overlay behavior, and session-title updates.

## Scope

### In scope

- Chat search behavior
- Archive behavior and related state transitions
- Review overlay and session-title updates

### Out of scope

- Shared composer behavior
- Upload lifecycle and file state

## Success Criteria

The work is complete when all of the following are true:

- [ ] Search, archive, review-overlay, and title-sync behavior match Expo closely enough for parity review
- [ ] Overlay and archive behavior are stable under normal conversation usage
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep overlay and archive behavior attached to the stable conversation host from the prior work item
- Preserve the current session-title update semantics

## Dependencies

- `chat-message-list-and-conversation-actions`
- Current overlay and archive behavior from Expo

## Related Work

- Parent: `.kernel/milestones/4-1-chat-route-parity/`
- Blocks: `shared-composer-route-targeting-and-selection-chips`
- Blocked by: `chat-message-list-and-conversation-actions`
