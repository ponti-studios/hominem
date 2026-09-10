# Omiro voice

Voice input is integrated into the shared composer. The current production
pipeline records audio locally, transcribes the file on-device with iOS
SpeechAnalyzer, inserts the raw transcript, and optionally cleans it up in the
background through the API.

## Pipeline

```text
microphone permission -> AudioRecorder recording -> local audio file
-> VoiceTranscriber.transcribeFile -> raw transcript in composer
-> optional API cleanup
```

`useVoiceComposerInput` coordinates this pipeline. `useVoiceRecorder` owns
permission, start/stop/cancel, recorder errors, and lifecycle. The shared
recording controller in `components/media/audio.service.ts` owns the singleton
recorder, recording ownership, metering, file URI, keep-awake behavior, and
cleanup.

`VoiceRecordingPanel` owns the visible stop and cancel controls. Walkie-talkie
mode sends the raw transcript after recording stops; normal mode inserts it into
the composer. Recording state and voice-cleanup state are separate so a
transcription failure is not confused with a microphone permission/start
failure.

## iOS transcription

The `voice-transcriber` Expo module exposes `getPermissions()`,
`requestPermissions()`, and `transcribeFile(audioUri)`. The native
implementation uses `SpeechTranscriber`/`SpeechAnalyzer` and on-device model
assets. It validates the file URL, checks authorization, resolves the preferred
locale, reserves/downloads the locale model if needed, converts recorded audio
into the analyzer format, feeds the file in chunks, and accumulates finalized
results.

The returned result identifies the `speech-analyzer` engine and is always
on-device. There is no server transcription fallback in this module.

Native errors are kept in sync between Swift and TypeScript:

- `INVALID_AUDIO_URL`
- `RECOGNIZER_UNAVAILABLE`
- `MISSING_PERMISSION`
- `EMPTY_TRANSCRIPT`

An empty transcript is treated as a failure rather than inserted as blank
composer content. Temporary recording files are best-effort deleted after
successful processing and after failed transcription or task extraction.

## Cleanup and editing

The raw transcript is inserted before optional cleanup. `useVoiceCleanup` sends
the raw text, locale, and source to the API voice-cleanup route and reports
whether the text changed. Background cleanup must not overwrite edits made by
the user after insertion. If cleanup fails, the raw transcript remains usable.

Voice telemetry records boundary events and error categories, but must not log
transcript text, identifying file paths, tokens, cookies, or credentials.

## Testing and evidence

Unit coverage is under `apps/omiro/tests/hooks/`,
`apps/omiro/tests/components/composer/`, `apps/omiro/tests/components/voice/`,
and `apps/omiro/tests/services/ai/`. Exercise permission denial, recording
start failure, cancellation, invalid/missing files, unsupported recognizer,
empty speech, cleanup failure, and edits made while cleanup is pending.

Release-level acceptance requires a spoken recording on a physical iOS device,
because simulator audio does not prove the microphone and native SpeechAnalyzer
path. Keep the app’s Apple-only constraint: do not document or add Android
voice behavior.
