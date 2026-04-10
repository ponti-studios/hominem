# mobile-voice-waveform Specification

## Purpose
TBD - created by archiving change mobile-voice-composer-navigation-redesign. Update Purpose after archive.
## Requirements
### Requirement: Voice recording displays real-time audio level visualization

The voice input SHALL display a visual representation of audio levels during recording using animated bars.

#### Scenario: Recording shows animated bars
- **WHEN** user starts recording
- **THEN** 12 vertical bars animate based on audio metering values
- **AND** bars update at approximately 60fps using react-native-reanimated

### Requirement: Waveform visualization uses normalized audio levels

The waveform bars SHALL normalize audio levels from -50dB to 0dB into bar heights from 5px to maximum height.

#### Scenario: Quiet audio shows small bars
- **WHEN** audio level is -40dB
- **THEN** bar height is approximately 15% of maximum
- **AND** bar color is the destructive (recording) color

#### Scenario: Loud audio shows tall bars
- **WHEN** audio level is -10dB
- **THEN** bar height is approximately 80% of maximum
- **AND** bar color is the destructive (recording) color

### Requirement: Playback shows static waveform representation

The voice playback SHALL display a static waveform-like visualization of the recorded audio.

#### Scenario: Playback displays waveform bars
- **WHEN** audio is in playback mode
- **THEN** a set of bars representing the recording's audio levels is displayed
- **AND** the bars are styled differently from recording mode (accent color)

