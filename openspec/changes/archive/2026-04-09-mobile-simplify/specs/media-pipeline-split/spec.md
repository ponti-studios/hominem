## ADDED Requirements

### Requirement: Audio recorder hook SHALL only handle recording

The `useRecorder` hook (extracted from `useMobileAudioRecorder`) SHALL only manage:
- Recording state machine (`IDLE` → `REQUESTING_PERMISSION` → `PREPARING` → `RECORDING` → `STOPPING`)
- 100ms metering polling for audio levels
- Keep-awake management during recording
- Start/stop/pause controls

#### Scenario: useRecorder manages recording lifecycle

- **WHEN** `startRecording()` is called
- **THEN** recording state transitions: `IDLE` → `REQUESTING_PERMISSION` → `PREPARING` → `RECORDING`
- **AND** metering data is collected every 100ms
- **AND** device stays awake via `activateKeepAwakeAsync`

#### Scenario: useRecorder returns only recording state

- **WHEN** `useRecorder` is called
- **THEN** it returns `{ isRecording, meterings, startRecording, stopRecording, recorderState }`
- **AND** it does NOT trigger transcription

### Requirement: Transcription SHALL be a separate hook

The `useTranscriber` hook (from `use-audio-transcribe.ts`) SHALL be responsible for:
- Converting audio URI to text
- File size validation (25MB limit)
- 60s timeout with AbortController
- PostHog event emission

#### Scenario: useTranscriber transcribes audio

- **WHEN** `transcribeAudio(audioUri)` is called on `useTranscriber`
- **THEN** it uploads to `/api/voice/transcribe`
- **AND** returns the transcribed text

#### Scenario: useTranscriber validates file size

- **WHEN** audio file exceeds 25MB
- **THEN** it throws an error before uploading

### Requirement: VoiceInput component SHALL compose recorder and transcriber

The `MobileVoiceInput` (or renamed `VoiceInput`) component SHALL compose `useRecorder` and `useTranscriber` hooks, connecting stop-recording to start-transcription.

#### Scenario: VoiceInput coordinates recorder and transcriber

- **WHEN** user stops recording in VoiceInput
- **THEN** if `autoTranscribe` is true, `useTranscriber.transcribeAudio` is called
- **AND** the transcription result is passed to `onAudioTranscribed`

### Requirement: useTTS hook SHALL remain separate

The `useTTS` hook SHALL remain unchanged and continue to handle text-to-speech playback.

#### Scenario: useTTS handles TTS independently

- **WHEN** `useTTS.speak(id, text)` is called
- **THEN** it fetches audio from TTS endpoint
- **AND** plays via `expo-audio` `AudioPlayer`

### Requirement: Media components directory SHALL be reorganized

```
components/media/
├── voice/
│   ├── use-recorder.ts         # extracted from use-mobile-audio-recorder
│   ├── use-transcriber.ts      # (renamed from use-audio-transcribe)
│   ├── VoiceInput.tsx          # extracted from mobile-voice-input.tsx
│   └── VoiceSessionModal.tsx   # (unchanged)
├── camera/
│   └── CameraModal.tsx        # (unchanged)
├── AudioLevelVisualizer.tsx   # (from audio-meterings.tsx)
└── audio-meterings.tsx         # (may be merged into AudioLevelVisualizer)
```

#### Scenario: Voice concerns are in voice/ subdirectory

- **WHEN** examining `components/media/voice/`
- **THEN** it contains only voice-related hooks and components
- **AND** camera-related code is in `camera/`
