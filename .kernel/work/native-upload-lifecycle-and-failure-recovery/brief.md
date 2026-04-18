# Work Brief

## Goal

Native upload lifecycle and failure recovery parity

## Context

This work makes file-backed workflows real by implementing progress, failure, retry, and recovery behavior. It provides the attachment milestone's network and state baseline.

## Scope

### In scope

- Upload progress and completion behavior
- Failure handling, retry, and recovery paths
- Upload-state behavior needed by note and chat hosts

### Out of scope

- Attachment insertion and removal UI parity
- Camera and voice capture behavior

## Success Criteria

The work is complete when all of the following are true:

- [ ] Upload progress, failure, retry, and recovery behavior match the current app closely enough for parity review
- [ ] Upload lifecycle is stable enough for shared attachment state across hosts
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Verify failure and retry behavior explicitly instead of treating the happy path as sufficient
- Keep upload-state behavior reusable across note and chat hosts

## Dependencies

- Milestone 4.2 shared composer parity
- Current upload contract from Expo

## Related Work

- Parent: `.kernel/milestones/4-3-file-and-attachment-parity/`
- Blocks: `attachment-state-across-notes-chat-and-local-cache`
- Blocked by: `4-2-shared-composer-parity`
