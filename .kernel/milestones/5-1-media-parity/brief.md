# Milestone Brief

## Goal

5.1 — Media parity: deliver native camera capture, audio recording, transcription, waveform, and text-to-speech behavior inside the migrated product hosts.

## Target Date

TBD

## Context

This milestone brings hardware-backed media behavior into the native app. It is the Phase 5 critical path because it proves the shared media-host contract inside composer, note, and chat surfaces.

Before this milestone: the app can support text and file workflows, but media capture and speech flows are absent. After this milestone: the native app can capture, transcribe, and play back media inside real product hosts with parity-grade behavior, and the remaining Phase 5 work can rely on stable media semantics.

## Scope

### In scope

- Camera capture and attachment handoff
- Audio recording, waveform behavior, transcription, and text-to-speech
- Media-host integration with composer and chat flows
- Native media-state behavior required for later rollout validation

### Out of scope

- Notifications, review prompts, app lock, and other device-control behavior
- App intents, shortcuts, and widget integration

## Acceptance Criteria

This milestone is complete when:

- [ ] Camera capture and media handoff work inside supported product flows
- [ ] Audio recording, transcription, waveform, and text-to-speech behavior match the current app closely enough for parity review
- [ ] Media behavior is stable enough for the rollout and validation phase to depend on
- [ ] All linked work items are archived
- [ ] No critical bugs remain open against this milestone's scope

## Work Items

1. **native-camera-capture-and-attachment-handoff**: implement camera capture and handoff into the existing attachment hosts.
2. **audio-recording-transcription-waveform-and-tts**: implement audio recording, waveform behavior, transcription, and text-to-speech parity.

## Ownership

- DRI: mobile team
- Scope sign-off: product leadership
- Technical sign-off: mobile team

## Dependencies

- Phase 4 shared composer and attachment-state parity
- Stable variant entitlements and media permissions from Phase 1

## Risks

| Risk                                                               | Impact | Mitigation                                                                 |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| Media capture works in isolation but not inside real product hosts | High   | Verify all media flows inside composer and chat hosts before sign-off      |
| Audio and transcription behavior differ materially from Expo       | High   | Test capture, transcription, and playback as separate verified transitions |
