# mobile-voice-pause-resume Specification

## Purpose
TBD - created by archiving change mobile-voice-composer-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: Voice recording can be paused

The voice input SHALL allow users to pause an active recording without losing the recorded audio.

#### Scenario: User pauses recording
- **WHEN** user taps pause button during recording
- **THEN** recording state changes to PAUSED
- **AND** audio metering stops updating
- **AND** pause button becomes resume button

### Requirement: Paused recording can be resumed

The voice input SHALL allow users to resume a paused recording and continue recording.

#### Scenario: User resumes recording
- **WHEN** user taps resume button while paused
- **THEN** recording state changes to RECORDING
- **AND** audio metering resumes updating
- **AND** the existing audio is preserved

### Requirement: Pause state shows visual indicator

The paused recording SHALL display a clear visual indication that recording is paused.

#### Scenario: Paused state displays indicator
- **WHEN** recording is in PAUSED state
- **THEN** a "Paused" label or icon is displayed
- **AND** the waveform visualization is visible but dimmed
- **AND** a resume button is prominently displayed

### Requirement: Haptic feedback on pause/resume

The voice input SHALL provide haptic feedback when pausing and resuming recording.

#### Scenario: Pause triggers haptic
- **WHEN** user taps pause button
- **THEN** a medium impact haptic is triggered

#### Scenario: Resume triggers haptic
- **WHEN** user taps resume button
- **THEN** a light impact haptic is triggered

