## ADDED Requirements

### Requirement: Recorded audio can be played back

After recording stops, the user SHALL be able to play back the recorded audio before sending or discarding.

#### Scenario: User plays recorded audio
- **WHEN** user taps play button after recording
- **THEN** the recorded audio plays through the device speaker
- **AND** a playhead indicator shows current position on the waveform

### Requirement: Playback position is scrubbable

The user SHALL be able to scrub through the recorded audio by dragging the playhead.

#### Scenario: User scrubs playback
- **WHEN** user drags the playhead on the waveform
- **THEN** the playback position jumps to the dragged location
- **AND** audio playback continues from the new position

### Requirement: Playback shows elapsed and total time

The playback SHALL display both elapsed time and total duration.

#### Scenario: Playback displays time
- **WHEN** audio is in playback mode
- **THEN** elapsed time is shown (e.g., "00:45")
- **AND** total duration is shown (e.g., "/ 02:30")

### Requirement: Playback has stop control

The user SHALL be able to stop playback at any time.

#### Scenario: User stops playback
- **WHEN** user taps stop button during playback
- **THEN** playback stops
- **AND** playhead returns to the beginning
