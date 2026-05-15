# Work Brief

## Goal

Note editor autosave, detach, and chat handoff parity

## Context

This work adds the high-risk note behaviors that make notes useful in daily work: saving automatically, detaching files, and transitioning into chat flows.

## Scope

### In scope

- Note editor state and autosave behavior
- File detachment behavior inside note detail
- Note-to-chat handoff routing and state preservation

### Out of scope

- Global composer behavior
- Chat conversation delivery beyond the handoff boundary

## Success Criteria

The work is complete when all of the following are true:

- [ ] Note edits save with parity-grade behavior in the supported editor scenarios
- [ ] File detachment and note-to-chat handoff work reliably on device
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve current autosave triggers and route-transition behavior unless explicitly changed
- Keep handoff logic limited to the existing note-to-chat contract

## Dependencies

- `native-notes-list-detail-and-search`
- Current note-editor and handoff behavior from Expo

## Related Work

- Parent: `.kernel/milestones/3-2-notes-parity/`
- Blocks: `phase-4-chat-composer-and-files`
- Blocked by: `native-notes-list-detail-and-search`
