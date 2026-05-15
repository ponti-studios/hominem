# Work Brief

## Goal

Native camera capture and attachment handoff parity

## Context

This work gives the native app a first-class camera source and attaches it to the already-migrated file host flows. It is the first proving step for Milestone 5.1 because it validates the camera-to-host boundary inside real product surfaces.

## Scope

### In scope

- Camera capture flow
- Attachment handoff into existing note and chat hosts
- Camera-state behavior required by parity review

### Out of scope

- Audio recording and speech behavior
- Widget or app-intent media sources

## Success Criteria

The work is complete when all of the following are true:

- [ ] Camera capture and attachment handoff work with parity-grade behavior inside supported hosts
- [ ] Camera-source behavior is stable enough for the rest of Milestone 5.1 to build on
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Validate inside real hosts rather than isolated camera demos
- Keep attachment handoff aligned with Phase 4 file-state behavior

## Dependencies

- Phase 4 file and attachment parity
- Stable camera permission and entitlement setup from Phase 1

## Related Work

- Parent: `.kernel/milestones/5-1-media-parity/`
- Blocks: `5-1-media-parity`
- Blocked by: `4-3-file-and-attachment-parity`
