# Work Brief

## Goal

Shared composer route targeting and selection-chip parity

## Context

This work creates the shared composer host that spans inbox, notes, and chat. It defines where the composer appears and how route targeting is communicated across surfaces.

## Scope

### In scope

- Shared composer host and visibility rules
- Route targeting and selection-chip behavior
- Cross-route composer presence and positioning

### Out of scope

- Note mentions, draft restore, and submit semantics
- Upload and attachment state behavior

## Success Criteria

The work is complete when all of the following are true:

- [ ] The shared composer host behaves consistently across supported routes
- [ ] Targeting and selection-chip behavior match the current app closely enough for parity review
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Use one shared composer host instead of route-specific implementations
- Preserve current visibility and targeting rules unless explicitly changed

## Dependencies

- Milestone 4.1 chat route parity
- Current composer routing behavior from Expo

## Related Work

- Parent: `.kernel/milestones/4-2-shared-composer-parity/`
- Blocks: `note-mentions-draft-restore-and-submit-actions`
- Blocked by: `4-1-chat-route-parity`
