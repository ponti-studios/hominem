# Work Brief

## Goal

Native notes list, detail, and search parity

## Context

This work brings the note surface into native by covering the route flow from note discovery through note detail. It establishes the browse and open behavior that later editor work builds on.

## Scope

### In scope

- Notes list and note detail routes
- Search dependencies and create or open behavior
- Note selection and navigation behavior

### Out of scope

- Editor autosave and file detachment behavior
- Note-to-chat handoff details

## Success Criteria

The work is complete when all of the following are true:

- [ ] Users can browse, search, create, and open notes with parity-grade behavior
- [ ] Note detail routing is stable enough for later editor work
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Keep note browse and detail behavior aligned with the current app's route and selection model
- Avoid baking editor-specific assumptions into the route layer

## Dependencies

- Milestone 3.1 inbox and data-layer outcomes
- Stable note-service contract from the current app

## Related Work

- Parent: `.kernel/milestones/3-2-notes-parity/`
- Blocks: `note-editor-autosave-detach-and-chat-handoff`
- Blocked by: `3-1-inbox-parity`
