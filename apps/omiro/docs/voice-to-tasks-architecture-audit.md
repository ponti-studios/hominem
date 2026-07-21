# Voice-to-tasks architecture

**Updated:** 2026-07-20  
**Scope:** iOS voice recording → transcription → AI extraction → task persistence in Omiro.  
**Status:** Current-state architecture and residual risks.

This document replaces the 2026-07-03 audit backlog. The original findings were useful during implementation, but most are now resolved and should not be treated as open work.

## Current flow

```text
tasks/index.tsx or composer screen
        │
        ▼
useTaskVoiceCapture / useVoiceComposerInput
        │
        ▼
useVoiceRecorder
  ├─ permission and owner arbitration
  ├─ start/stop/cancel lifecycle
  └─ navigation/unmount cleanup
        │ fileUri
        ▼
VoiceTranscriberModule (iOS SpeechAnalyzer)
        │ rawText
        ├─ composer: insert transcript, then background cleanup
        └─ tasks: POST /tasks/voice → schema validation → atomic task creation
```

## Boundary decisions

- `audio.service.ts` owns the singleton recorder, metering polling, ownership, file URI, and recorder cleanup.
- `useVoiceRecorder.ts` owns shared React lifecycle behavior and delegates post-stop processing to its caller.
- `RecordingLevelMeter.tsx` is the only React consumer of per-poll metering data. Other consumers subscribe to the stable core snapshot, avoiding a 10 Hz component-tree update.
- `VoiceTranscriberModule.swift` is an iOS-only Expo Module using `SpeechAnalyzer` and on-device speech assets.
- The composer owns draft insertion and stale-draft protection. Tasks own transcription-to-task extraction and transcript recovery when extraction fails.
- The task client parses the response with `TasksVoiceOutputSchema` before updating the TanStack Query cache.

## Findings resolved since the original audit

| Original finding | Current disposition |
|---|---|
| Metering re-render waterfall | Resolved by `getRecordingCoreSnapshot()` and direct meter subscription. |
| Duplicated voice lifecycle logic | Resolved by `useVoiceRecorder`. |
| Lost transcript after task extraction failure | Resolved; `TaskVoiceCaptureError` carries the transcript and the tasks UI displays it. |
| Dual stop buttons | Resolved; `ComposerToolbar` hides the mic while recording and `VoiceRecordingPanel` owns the stop action. |
| Stored derived error presentation | Resolved; errors store a code and presentation is derived at render time. |
| Untyped task API response | Resolved with `TasksVoiceOutputSchema.parse()`. |
| Inconsistent composer error presentation | Resolved; composer errors use the inline banner pattern. |
| Native error-code magic strings | Resolved on the TypeScript side with `VoiceTranscriberErrorCode`. |

## Residual risks and follow-up

### 1. Keep temporary-file behavior and copy aligned

Both voice consumers best-effort delete the recording after transcription or task-creation failure. The error presentation must not claim that the recording was kept. If product wants retry-from-audio, the lifecycle needs a deliberate retained-file state instead of relying on `lastRecordingUri`.

### 2. Test failure recovery at the hook boundary

The highest-value coverage is:

- transcription failure attempts temporary-file cleanup;
- task extraction failure preserves and displays the transcript;
- permission errors map to the actionable permission state;
- successful transcription inserts into the composer draft without allowing background cleanup to overwrite later user edits.

Native transcription should also be exercised on a physical iOS device because simulator coverage cannot validate microphone and SpeechAnalyzer behavior.

### 3. Preserve a bounded failure path for native transcription

The historical hang was caused by a native callback lifetime bug and is documented in [voice-transcription-hang-postmortem.md](./voice-transcription-hang-postmortem.md). The current implementation uses `SpeechAnalyzer`, but the JS/native boundary still deserves a bounded failure strategy and an on-device regression check so a future native await cannot leave the UI busy indefinitely.

## Positive patterns to preserve

- iOS-only native transcription, consistent with the Omiro platform boundary.
- `useSyncExternalStore` for the recorder singleton.
- Stable owner checks preventing simultaneous recordings.
- Reanimated meter and recording indicator animations on the UI thread.
- Keep-awake activation during recording.
- Best-effort cleanup on abandonment and processing failure.
- Ref-based draft reads and stale-draft protection during asynchronous cleanup.
- Atomic server-side task creation and optimistic query-cache updates.

