# Composer: Voice Input

## Entry point

The `waveform` button in the accessory row calls `voiceModalRef.current?.present()`, which opens the `VoiceSessionModal` bottom sheet.

> **Known bug**: `isVoiceOpen` is never set to `true`, so `VoiceSessionModal` returns `null` from its `if (!visible) return null` guard and never actually mounts. See [known-issues.md](./known-issues.md#2-voice-modal-never-renders).

## Component tree

```
VoiceSessionModal (BottomSheetModal, snaps: ['50%', '90%'])
  └─ VoiceInput (autoTranscribe=true)
       ├─ WaveformVisualizer
       └─ controls: mic/stop button, duration counter, pause/resume
```

## VoiceSessionModal

`components/media/voice-session-modal.tsx`

Props:
- `visible: boolean` — gates rendering (broken; see known issues)
- `bottomSheetModalRef` — imperative ref for `present()` / `dismiss()`
- `onAudioTranscribed(transcript)` — called with the transcript text on success
- `onClose()` — called on dismiss

On transcription success, calls `onAudioTranscribed` then `handleDismiss`. On error, calls `handleDismiss` silently (no user feedback — known issue).

## VoiceInput

`components/media/voice/VoiceInput.tsx`

When `autoTranscribe={true}`:
- On stop recording, immediately calls `useTranscriber.mutateAsync(audioUri)`
- On transcription success, calls `onAudioTranscribed(transcript)`
- On transcription error, calls `onError()`

Controls:
- `AnimatedPressable` mic/stop button — color interpolates from `muted` to `destructive` while recording
- Duration counter — counts up in seconds using `setInterval`
- Pause button (`clock` icon) — visible while recording
- Resume button (`arrow.clockwise` icon) — visible while paused
- Retry / Clear buttons — visible after a failed transcription (if `lastRecordingUri` is set)

## useInput hook

`components/media/voice/useInput.ts`

Bridges `VoiceInput` to `audio.service.ts`. Subscribes to the recording store via `subscribeRecording`:

```ts
useEffect(() => {
  return subscribeRecording(setSnapshot);
}, []);
```

Exposes:
- `isRecording` — `snapshot.state === 'RECORDING'`
- `isPaused` — `snapshot.state === 'PAUSED'`
- `meterings` — last 12 dB samples for the waveform
- `startRecording`, `stopRecording`, `pauseRecording`, `resumeRecording`

## audio.service.ts — recording controller

`components/media/audio.service.ts` manages recording as a module-level singleton using a pub/sub store pattern.

### RecorderState machine

```
IDLE
  → REQUESTING_PERMISSION  (startRecording called)
    → IDLE                 (permission denied)
    → PREPARING            (permission granted)
      → RECORDING          (prepareToRecordAsync + record succeed)
        → PAUSED           (pauseRecording called)
          → RECORDING      (resumeRecording called)
        → STOPPING         (stopRecording called)
          → IDLE           (stop complete)
```

### startRecording flow

1. Guard: returns `{ ok: false, reason: 'busy' }` if not `IDLE`
2. `requestRecordingPermissionsAsync()` — returns `{ ok: false, reason: 'permission-denied' }` if denied
3. `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })`
4. `activateKeepAwakeAsync()` — prevents screen sleep
5. `prepareToRecordAsync()` + `record()` on the `AudioRecorder`
6. Starts metering poll at 100ms intervals
7. Emits `voice_record_started` analytics event

### stopRecording flow

1. Guard: no-op if already `IDLE` or `STOPPING`
2. `recorder.stop()`
3. Stops metering poll
4. `deactivateKeepAwake()`
5. Returns the file URI
6. Emits `voice_record_stopped` analytics event

### Metering

The recorder polls `recorder.getStatus().metering` every 100ms. The last 12 samples are retained in a rolling buffer:

```ts
meterings: [...current.meterings, metering].slice(-12)
```

These values drive the `WaveformVisualizer` bar heights.

## WaveformVisualizer

`components/media/voice/WaveformVisualizer.tsx`

Renders 12 animated bars. Each bar:
- Width: 4px, border-radius: 2px
- Height: `withTiming(isActive ? Math.max(4, level * 60) : 4, { duration: 100 })`
- Active bars are `theme.colors.destructive`, playback bars are `theme.colors.primary`
- Empty bars (buffer not yet full) render at minimum height (4px)

The level value is in dBFS (-50 to 0). The `level * 60` formula maps this to a pixel height (0–60px), clamped to a minimum of 4px.

## useTranscriber

`components/media/voice/useTranscriber.ts`

A `useMutation` that POSTs audio to `/api/voice/transcribe`:

1. Checks auth headers — throws if missing
2. Checks file size ≤ 25MB via `expo-file-system`
3. Infers MIME type from URI extension
4. Sends `multipart/form-data` POST with `audio` field
5. 60-second timeout via `AbortController`
6. Emits analytics events: `voice_transcribe_requested`, `voice_transcribe_succeeded`, `voice_transcribe_failed`
7. Parses response with `parseVoiceTranscribeSuccessResponse` / `parseVoiceTranscribeErrorResponse`

`AbortError` is silently ignored (user cancelled). All other errors call `onError`.

## handleVoiceTranscript

In `useComposerMediaActions.ts`, the transcript is appended to the existing message:

```ts
function appendVoiceTranscript(text: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();
  if (trimmedTranscript.length === 0) return text;
  return text.trim().length > 0 ? `${text}\n${trimmedTranscript}` : trimmedTranscript;
}
```

If there is existing text, a newline separator is inserted. If the input was empty, the transcript replaces it.

After appending, `setIsRecording(false)` and `setMode('text')` are called.

## Haptics

| Event | Haptic |
|---|---|
| Start recording | `ImpactFeedbackStyle.Medium` |
| Stop recording | `NotificationFeedbackType.Success` |
| Pause | `ImpactFeedbackStyle.Light` |
| Resume | `ImpactFeedbackStyle.Light` |
