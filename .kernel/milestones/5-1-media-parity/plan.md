# Milestone Plan

## Goal

5.1 — Media parity

## Approach

Keep 5.1 on the critical path for Phase 5. Camera capture is the preferred lead-in because it proves media-source handoff into the migrated hosts, but audio and speech work can start as soon as the shared host contract stops moving rather than waiting for camera work to close completely. Keep all validation inside the real product hosts rather than isolated demos.

## Work Item Breakdown

| Work Item                                      | Purpose                                                             | Depends On                          |
| ---------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------- |
| native-camera-capture-and-attachment-handoff   | Camera capture and handoff into attachment hosts                    | 4.3 file and attachment parity      |
| audio-recording-transcription-waveform-and-tts | Audio recording, waveform, transcription, and text-to-speech parity | Stable media-host contract from 4.3 |

## Critical Path

Stabilizing the shared media-host contract is the bottleneck. Camera capture is the first proving step, and the milestone does not close until both capture and speech flows are validated inside real hosts.

## Sequencing Rationale

Camera capture usually lands first because it exercises attachment handoff with less system complexity than transcription and playback. Audio and speech should begin once the host contract is stable, not only after camera work is fully archived, so Phase 5 does not serialize unnecessarily behind one media surface.

## Deliverables

- Native camera capture integrated with attachment hosts
- Audio recording, waveform, transcription, and TTS parity
- Stable media behavior inside real product flows

## Acceptance Criteria

This milestone is complete when:

- [ ] All work items are archived
- [ ] Media behavior is verified on device inside supported hosts
- [ ] Phase 5 can proceed without unresolved media-host or speech-state blockers

## Risks

| Risk                                                | Likelihood | Impact | Mitigation                                                                      |
| --------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| Host integration hides media-state bugs until late  | Med        | High   | Validate each media path inside its real host before closure                    |
| Speech behavior is under-specified relative to Expo | Med        | High   | Compare recording, transcription, and playback semantics directly during review |

## Open Questions

- Which media-host scenarios are mandatory for parity sign-off versus acceptable follow-up coverage? Owner: product leadership. Deadline: before milestone review.
- What latency or quality thresholds matter for transcription and playback parity? Owner: product leadership and mobile team. Deadline: before audio work exits.
