# Work Brief

## Goal

Shared attachment state across notes, chat, and local cache parity

## Context

This work connects upload outcomes to real product hosts. It ensures that insertion, removal, and local attachment state behave consistently whether the user is in notes or chat.

## Scope

### In scope

- Attachment insertion and removal in notes and chat
- Shared local-state behavior for attachments
- Host-level parity across note and conversation flows

### Out of scope

- Camera and voice capture sources
- Widget or app-intent file flows

## Success Criteria

The work is complete when all of the following are true:

- [ ] Attachment insertion and removal behave consistently in notes and chat
- [ ] Local attachment state remains coherent across supported host transitions
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Prefer one shared attachment-state model over host-specific implementations
- Keep media-source behavior out of scope until Phase 5

## Dependencies

- `native-upload-lifecycle-and-failure-recovery`
- Current attachment-state behavior in Expo

## Related Work

- Parent: `.kernel/milestones/4-3-file-and-attachment-parity/`
- Blocks: `5-1-media-parity`
- Blocked by: `native-upload-lifecycle-and-failure-recovery`
