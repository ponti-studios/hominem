# Work Brief

## Goal

Note mentions, draft restore, and submit action parity

## Context

This work adds the richer stateful composer behavior users rely on: remembering drafts, targeting notes, and submitting through the same primary and secondary paths as Expo.

## Scope

### In scope

- Note mentions and targeting behavior
- Draft restore across supported route changes
- Primary and secondary submit action parity

### Out of scope

- Attachment upload lifecycle
- Media-specific composer integrations

## Success Criteria

The work is complete when all of the following are true:

- [ ] Draft restore, note mentions, and submit actions match the current app closely enough for parity review
- [ ] Cross-route composer state survives the supported transitions reliably
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Preserve current draft restore rules and avoid overexpanding into attachment state
- Keep submit semantics aligned with existing primary and secondary action behavior

## Dependencies

- `shared-composer-route-targeting-and-selection-chips`
- Current draft, mention, and submit behavior from Expo

## Related Work

- Parent: `.kernel/milestones/4-2-shared-composer-parity/`
- Blocks: `native-upload-lifecycle-and-failure-recovery`
- Blocked by: `shared-composer-route-targeting-and-selection-chips`
