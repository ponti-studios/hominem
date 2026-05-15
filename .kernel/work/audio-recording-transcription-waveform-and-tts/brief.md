# Work Brief

## Goal

Audio recording, transcription, waveform, and TTS parity

## Context

This work delivers the richer media and speech experience used in chat and composer flows. It must match current capture, transcription, and playback behavior closely enough to preserve user trust. It can begin once the shared media-host contract is stable, even if the camera work is still being finalized.

## Scope

### In scope

- Audio recording and waveform behavior
- Transcription flow
- Text-to-speech behavior

### Out of scope

- Camera capture and file handoff
- Notification or telemetry behavior

## Success Criteria

The work is complete when all of the following are true:

- [ ] Recording, waveform, transcription, and TTS behavior match the current app closely enough for parity review
- [ ] Speech behaviors are stable inside supported product hosts and ready for product sign-off
- [ ] All tasks in tasks.md are checked off
- [ ] The implementation has been reviewed and no blockers remain

## Constraints

- Validate in real product hosts instead of isolated media demos
- Keep speech-state behavior explicit and testable

## Dependencies

- Stable media-host contract from Phase 4 file and attachment parity
- Current audio and speech behavior from Expo

## Related Work

- Parent: `.kernel/milestones/5-1-media-parity/`
- Blocks: `5-1-media-parity`
- Blocked by: `4-3-file-and-attachment-parity`
