# Implementation Plan

## Goal

Audio recording, transcription, waveform, and TTS parity

## Approach

Treat recording, transcription, waveform, and playback as one media-state pipeline and validate each stage in the host flows that actually use it. Start once the shared media-host contract is stable, use findings from the camera handoff work, and keep device and interruption edge cases explicit during review.

## Key Decisions

| Decision          | Choice                                                                               | Rationale                                                | Alternative Considered                                                         |
| ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pipeline boundary | Recording, transcription, waveform, and playback are validated as one media pipeline | Preserves the user-visible flow they actually experience | Splitting each piece too early, rejected because it obscures end-to-end parity |

## Implementation Steps

### 1. Clarify scope and success criteria

- Confirm recording, transcription, and playback behaviors that must match Expo

### 2. Implement the core path

- Build recording and waveform behavior
- Recreate transcription and TTS flows inside product hosts

### 3. Verify behavior with tests

- Test media-state transitions where feasible
- Verify recording, transcription, and playback on device

### 4. Capture follow-up work

- Record any rollout-specific speech or media caveats for Phase 6

## Risks

| Risk                                                             | Likelihood | Impact | Mitigation                                          |
| ---------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------- |
| Transcription or TTS quality differs enough to break trust       | Med        | High   | Review end-to-end behavior directly during sign-off |
| Media-state bugs only appear under interruption or backgrounding | Med        | Med    | Include interruption cases in manual validation     |

## Validation

How to verify this work is correct:

- **Automated:** targeted media-state tests where feasible
- **Manual:** verify recording, transcription, waveform, and TTS on device inside supported hosts
- **Regression:** camera-source and attachment-host behavior must remain stable

## Rollback

Disable advanced speech behaviors and fall back to non-speech media support until parity issues are corrected.
