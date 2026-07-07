# Voice-to-Tasks Architecture Audit

**Date:** 2026-07-03
**Scope:** Full-stack trace of voice recording → transcription → AI extraction → task persistence in the omiro app.
**Status:** Issues identified; none yet resolved.

---

## Architecture Overview

```
┌────────────────────┐    ┌──────────────────┐    ┌───────────────────────┐
│  tasks/index.tsx   │    │ use-task-voice-   │    │  audio.service.ts     │
│  (UI layer)        │───▶│ capture.ts        │───▶│  (expo-audio)         │
│                    │    │  (state machine)  │    │  (singleton recorder) │
└────────────────────┘    └──────────────────┘    └───────────────────────┘
         │                          │                        │
         │                          │                        │ fileUri
         │                          ▼                        ▼
         │                 ┌──────────────────┐    ┌───────────────────────┐
         │                 │ VoiceTranscriber  │◀───│  expo-audio .m4a     │
         │                 │ Module (Swift)    │    │  file on disk         │
         │                 │ SFSpeechRecognizer│    └───────────────────────┘
         │                 └──────────────────┘
         │                          │ rawText
         │                          ▼
         │                 ┌──────────────────┐    ┌───────────────────────┐
         │                 │ POST /tasks/voice │───▶│  extractVoiceTasks()  │
         │                 │ (Hono RPC)        │    │  @hominem/ai          │
         │                 └──────────────────┘    │  OpenRouter LLM        │
         │                          │              └───────────────────────┘
         │                          │ tasks[]
         │                          ▼
         │                 ┌──────────────────┐
         │                 │ TaskRepository    │
         │                 │ (Drizzle/Postgres)│
         │                 └──────────────────┘
         │                          │
         ▼                          ▼
  ┌──────────────────────────────────────────┐
  │         TanStack Query cache update      │
  │         FlashList re-render              │
  │         Haptic + success banner          │
  └──────────────────────────────────────────┘
```

---

## Issues

### 🔴 1. Metering Re-render Waterfall (10 re-renders/sec)

**Severity:** Critical
**Files:** `useVoiceComposerInput.ts`, `useTaskVoiceCapture.ts`, `RecordingLevelMeter.tsx`, `useComposerController.ts`, `InboxComposerContent.tsx`, `ChatComposerContent.tsx`

**Problem:** During recording, the audio service polls the recorder's metering value every 100ms and pushes it into a `meterings[]` array. This array is exposed through `useSyncExternalStore` in the voice hooks and passed as a prop through the entire component tree:

```
audio.service.ts (100ms poll)
  → setSnapshot → useSyncExternalStore (useVoiceComposerInput / useTaskVoiceCapture)
    → useComposerController return value
      → InboxComposerContent / ChatComposerContent re-render
        → ComposerShell re-render
        → ComposerToolbar re-render (multiple IconButtons with Reanimated enter/exit)
        → VoiceRecordingPanel re-render
        → RecordingLevelMeter re-render (12 × LevelBar children)
```

Every 100ms, the **entire composer tree** re-renders — `ComposerTextInput`, all toolbar buttons, attachment rows, everything — solely to deliver 12 dB values to the `RecordingLevelMeter`.

`RecordingLevelMeter` already uses Reanimated shared values (`useSharedValue` + `withTiming`) for each `LevelBar`. The React re-render is redundant: it reconstructs the same 12-bar array and passes the same `db` values to `LevelBar`, which calls `withTiming` to the (potentially same) value. The bar animations already run on the UI thread — the JS thread re-renders are pure waste.

**Fix:** Subscribe `RecordingLevelMeter` directly to the recording store via its own `useSyncExternalStore`, removing `recordingMeterings` from the voice hook's return value and the prop waterfall entirely.

```tsx
// In RecordingLevelMeter.tsx — subscribe directly, skip the prop waterfall
export function RecordingLevelMeter() {
  const meterings = useSyncExternalStore(
    subscribeRecording,
    () => getRecordingSnapshot().meterings,
  );
  // ... same bar rendering
}
```

Then remove `recordingMeterings` from:
- `useVoiceComposerInput` return value
- `useComposerController` return value
- `InboxComposerContent` / `ChatComposerContent` prop passing

The tasks screen (`tasks/index.tsx`) passes `meterings` to `VoiceRecordingPanel` directly (not through `useComposerController`), so the same fix applies there.

This eliminates 10 unnecessary re-renders/second from the entire composer and tasks screen trees during recording.

---

### 🟠 2. Orphaned `.m4a` Files on Transcription Failure

**Severity:** High
**Files:** `useTaskVoiceCapture.ts` (line ~100), `useVoiceComposerInput.ts` (line ~80)

**Problem:** When `VoiceTranscriberModule.transcribeFile(fileUri)` throws (e.g., permission revoked mid-session, recognizer unavailable, empty audio), the `.m4a` recording file at `fileUri` is never deleted.

- `stopRecording` captures `recorder.uri`, resets the snapshot to `IDLE`, and returns `{ ok: true, fileUri }`.
- The file is only deleted if `discardRecording` is called (user cancels, unmounts, or navigates away).
- On transcription failure, no code path calls `discardRecording` or deletes the file.
- The error message says "Your recording was kept" — accurately describing the leak.

Each failed transcription leaves an unreferenced `.m4a` file in the app's cache/sandbox. Over time, these accumulate with no cleanup mechanism.

**Fix:** Delete the file in the transcription `catch` block:

```typescript
} catch (transcriptionError) {
  // Best-effort cleanup — we can't process this file
  try {
    const { File } = require('expo-file-system');
    new File(fileUri).delete();
  } catch { /* ignore — file may already be gone */ }
  // ... set error
}
```

Applies to both `useTaskVoiceCapture.processStoppedRecording` and `useVoiceComposerInput.processStoppedRecording`.

---

### 🟠 3. Lost Transcript on LLM Extraction Failure

**Severity:** High
**File:** `useTaskVoiceCapture.ts` (line ~110)

**Problem:** After successful transcription, the raw transcript is sent to the LLM (`createVoiceTasks`). If the LLM call fails (network error, provider outage, rate limit, bad response), the error is surfaced as `'creation-failed'` but the `rawText` is only available inside the `processStoppedRecording` closure — it's never exposed to the user.

The user spoke into the mic. The audio was successfully captured and transcribed. But if the AI call fails, the transcript evaporates. The user has no way to recover it and manually create tasks from what they said.

**Fix:** Surface the raw transcript in the failure state:

```typescript
export interface TaskVoiceCaptureError {
  code: TaskVoiceCaptureErrorCode;
  title: string;
  message: string;
  transcript?: string;  // NEW: preserved for manual recovery
}
```

```typescript
} catch (creationError) {
  setError({
    ...createTaskVoiceCaptureError('creation-failed'),
    transcript: rawText,  // preserve for manual recovery
  });
}
```

In the UI, show the transcript alongside the error so the user can copy it or have it pre-filled into a task editor:

```tsx
{voiceCapture.state === 'failed' && voiceCapture.error?.transcript ? (
  <View style={styles.voiceBar}>
    <Text color="destructive">{voiceCapture.error.message}</Text>
    <Text color="text-secondary" numberOfLines={3}>
      Transcript: "{voiceCapture.error.transcript}"
    </Text>
  </View>
) : null}
```

---

### 🟠 4. Duplicated Voice Hook Logic (~50 lines)

**Severity:** High
**Files:** `useVoiceComposerInput.ts`, `useTaskVoiceCapture.ts`

**Problem:** The two voice hooks independently implement identical recording lifecycle logic. The only difference is what happens *after* `stopRecording` returns the `fileUri`:

| Shared Logic | Duplicated? |
|---|---|
| `useSyncExternalStore(subscribeRecording, getRecordingSnapshot, getRecordingSnapshot)` | Yes (3 identical lines each) |
| `isRecorderActive(state) && ownerId !== self.ownerId` guard | Yes |
| `ensureSpeechRecognitionPermission()` | Yes (identical) |
| `startVoiceRecording()` with `isStartingRef` debounce + permission flow | Yes |
| `handleMicPress()` / `handleVoicePress()` toggle logic | Yes (nearly identical) |
| `useFocusEffect` cleanup → `discardRecording(ownerId, 'navigated-away')` | Yes |
| `useEffect` unmount cleanup → `discardRecording(ownerId, 'unmounted')` | Yes |
| `getNativeErrorCode()` helper | Yes (identical function in both files) |

The divergence:
- **Composer**: transcribes → inserts into draft → runs cleanup
- **Tasks**: transcribes → sends to LLM → creates tasks

This is ~50 lines of duplicated code across two files. Any bug fix or behavior change to the recording lifecycle must be applied in two places.

**Fix:** Extract a shared `useVoiceRecorder` hook that manages the recording lifecycle and accepts a callback for what to do after stopping:

```typescript
// packages/shared/hooks/useVoiceRecorder.ts (or app-level shared hook)

function useVoiceRecorder(options: {
  onRecordingStopped: (fileUri: string) => Promise<void>;
}) {
  const ownerId = useId();
  const recordingSnapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot,
    getRecordingSnapshot,
  );
  // ... all shared recording/permission/cleanup logic ...

  const handleMicPress = useCallback(async () => {
    if (isRecordingElsewhere) return;
    if (isOwned && isActive) {
      const result = await stopRecording(ownerId);
      if (result.ok && result.fileUri) {
        await options.onRecordingStopped(result.fileUri);
      }
      return;
    }
    if (snapshot.state !== 'IDLE') return;
    await startVoiceRecording();
  }, [...]);

  return { handleMicPress, cancelRecording, isRecording, isRecordingElsewhere, ... };
}
```

Then each consumer provides only its post-recording behavior:

```typescript
// Composer
const voiceRecorder = useVoiceRecorder({
  onRecordingStopped: async (fileUri) => {
    const result = await VoiceTranscriberModule.transcribeFile(fileUri);
    setMessage(mergeTranscriptIntoDraft(getMessage(), result.rawText));
    void cleanup({ rawText: result.rawText, ... });
  },
});

// Tasks
const voiceRecorder = useVoiceRecorder({
  onRecordingStopped: async (fileUri) => {
    const result = await VoiceTranscriberModule.transcribeFile(fileUri);
    const output = await createVoiceTasks({ transcript: result.rawText, ... });
    setCreatedCount(output.tasks.length);
  },
});
```

---

### 🟡 5. Dual Stop Buttons During Recording

**Severity:** Medium
**Files:** `tasks/index.tsx`, `InboxComposerContent.tsx`, `ChatComposerContent.tsx`, `VoiceRecordingPanel.tsx`, `ComposerToolbar.tsx`

**Problem:** After the recent UX fix (adding `onDone` to `VoiceRecordingPanel`), during recording the user now sees **two** stop buttons:

1. **Toolbar mic button** — icon toggles to `stop.fill` during recording
2. **VoiceRecordingPanel stop button** — `stop.fill` with `variant="primary"` (NEW)

Both call the same handler (`handleMicPress` / `handleVoicePress`). This creates visual redundancy. The primary intent of adding the panel stop button was to make the stop action discoverable *within the recording UI itself* — which it does. But the toolbar button still also shows a stop icon, creating potential confusion about which one to press.

**Consideration:** The toolbar mic button could switch to a disabled/muted state or use a different icon during recording, since the panel now owns the primary stop affordance. Alternatively, remove the toolbar button entirely while recording and replace it with nothing (or a spacer), letting the panel be the single stop control.

---

### 🟡 6. Stored Derived Error Presentation

**Severity:** Medium
**Files:** `useTaskVoiceCapture.ts`, `voiceComposerInput.helpers.ts`

**Problem:** Both voice hooks compute `title` and `message` from an error `code` and store all three values in state:

```typescript
function createTaskVoiceCaptureError(code: TaskVoiceCaptureErrorCode): TaskVoiceCaptureError {
  switch (code) {
    case 'permission-denied':
      return {
        code,
        title: 'Microphone access required',
        message: 'Allow microphone and speech recognition access to add tasks by voice.',
      };
    // ... each case returns code + title + message
  }
}
```

`title` and `message` are derived entirely from `code`. Per the `state-ground-truth` and `react-state-minimize` references, derived values should be computed at render time, not stored in state. Storing them duplicates the source of truth and creates the risk of `error.code` and `error.message` drifting out of sync.

**Fix:** Store only the `code` in state. Derive `title`/`message` at render time:

```typescript
// Store only the code
const [errorCode, setErrorCode] = useState<TaskVoiceCaptureErrorCode | null>(null);

// Derive presentation at render
function getErrorPresentation(code: TaskVoiceCaptureErrorCode): { title: string; message: string } {
  switch (code) { /* ... */ }
}

// In render:
const error = errorCode ? { code: errorCode, ...getErrorPresentation(errorCode) } : null;
```

---

### 🟡 7. Untyped `as` Cast on API Response

**Severity:** Medium
**File:** `useVoiceTasks.ts`

**Problem:** The API response is parsed with a raw `as` cast, bypassing runtime validation:

```typescript
return (await res.json()) as TasksVoiceOutput;
```

If the server response shape changes (field renamed, new nullable field added, field type changes), the client silently carries mismatched data until something crashes deep in the component tree or cache update logic. The Zod schemas already exist on the server side.

**Fix:** Parse the response with Zod on the client:

```typescript
// Add a TasksVoiceOutputSchema exported from the shared schema package
const parsed = TasksVoiceOutputSchema.parse(await res.json());
```

This surfaces schema mismatches immediately during development and prevents silent data corruption in production.

---

### 🟢 8. Inconsistent Error UX Between Composer and Tasks

**Severity:** Low
**Files:** `InboxComposerContent.tsx`, `ChatComposerContent.tsx`, `tasks/index.tsx`

**Problem:** Voice errors are surfaced differently depending on context:

- **Composer** — `Alert.alert(title, message, [{ text: 'OK' }])` — system modal, blocks interaction
- **Tasks** — inline banner at screen bottom with dismiss — non-blocking, contextual

The inline banner pattern in the tasks screen is more consistent with omiro's design language (non-blocking, contextual, tappable to dismiss). The composer's `Alert.alert` was likely a shortcut.

**Fix:** Use the same inline banner pattern in both contexts. The `handleVoiceError` callback in the composer can set state that renders a banner instead of calling `Alert.alert`.

---

### 🟢 9. Magic String Contract for Native Error Codes

**Severity:** Low
**Files:** `VoiceTranscriberModule.swift`, `useTaskVoiceCapture.ts`, `useVoiceComposerInput.ts`

**Problem:** Error codes are compared as raw strings across the Swift/JS boundary:

```swift
// Swift (VoiceTranscriberModule.swift)
VoiceTranscriberException(code: "MISSING_PERMISSION", message: "...")
```

```typescript
// TypeScript (useTaskVoiceCapture.ts)
if (code === 'MISSING_PERMISSION') { ... }
```

The string `'MISSING_PERMISSION'` is a hidden contract. If either side changes the string — even a typo fix — the connection silently breaks and the error falls through to a generic `'transcription-failed'` handler.

**Fix:** Export error code constants from the native module so TypeScript can reference them:

```typescript
// VoiceTranscriberModule.ts
export const VoiceTranscriberErrorCode = {
  MISSING_PERMISSION: 'MISSING_PERMISSION',
  RECOGNIZER_UNAVAILABLE: 'RECOGNIZER_UNAVAILABLE',
  EMPTY_TRANSCRIPT: 'EMPTY_TRANSCRIPT',
  INVALID_AUDIO_URL: 'INVALID_AUDIO_URL',
} as const;

// Then in the hook:
if (code === VoiceTranscriberErrorCode.MISSING_PERMISSION) { ... }
```

Or better, have the native module return an enum value instead of a string, so TypeScript's type system catches mismatches at compile time.

---

## Positive Findings (Patterns That Are Correct)

| Pattern | Why It's Correct |
|---|---|
| `useSyncExternalStore` for recording singleton | Prevents tearing; the recording state is an external store, not React state |
| Singleton audio recorder with `ownerId` | Prevents two simultaneous recordings; owner-check in `stopRecording`/`discardRecording` |
| Reanimated UI-thread pulsing dot | `withRepeat(withTiming(...))` runs on UI thread, immune to JS thread blocking |
| `LevelBar` uses `useSharedValue` + `useEffect` → `withTiming` | Bar heights animate on UI thread via Reanimated |
| `expo-audio` (not `expo-av`) | Correct package per project media reference |
| `activateKeepAwakeAsync` during recording | Prevents screen sleep mid-recording |
| `expo-file-system` `File` API | Modern `expo-file-system/next` API for file operations |
| Swift delegate self-retain pattern | `SFSpeechRecognitionTask` holds delegate weakly; self-retain prevents premature deallocation |
| `VoiceTranscriberModule` as Expo Module | Modern module API, not legacy Turbo Module |
| `FlashList` for tasks list | Approved high-perf list primitive |
| Ref-based `getMessage()` in `useComposerDraft` | Avoids stale closures in async callbacks |
| `maybeApplyCleanedTranscript` stale-draft detection | Compares `currentDraft` vs `insertedDraft` — if user edited while cleanup ran, user's version wins |
| `useFocusEffect` + `useEffect` cleanup discarding | Recording is discarded on both navigation-away and unmount — no dangling recorder state |
| `isStartingRef` debounce | Prevents double-tap races in async `startVoiceRecording` |
| `VoiceRecordingPanel.onDone` (NEW) | Stop action is now discoverable directly in the recording UI |
| Custom `Exception` with `code` property in Swift | Allows JS to branch on `error.code` instead of parsing free-text messages |
| On-device speech recognition with graceful fallback | `requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition` — Apple handles fallback |
| `runInTransaction` for batch task creation | Atomic parent + children creation in Postgres |
| Optimistic TanStack Query cache updates | Tasks appear instantly; cache is populated before server confirmation |

---

## Summary

| # | Severity | Issue | File(s) |
|---|---|---|---|
| 1 | 🔴 Critical | 10 re-renders/sec waterfall from metering data | `useVoiceComposerInput.ts`, `useTaskVoiceCapture.ts`, `RecordingLevelMeter.tsx`, `useComposerController.ts` |
| 2 | 🟠 High | Orphaned `.m4a` files on transcription failure | `useTaskVoiceCapture.ts`, `useVoiceComposerInput.ts` |
| 3 | 🟠 High | Lost transcript on LLM extraction failure | `useTaskVoiceCapture.ts` |
| 4 | 🟠 High | ~50 lines duplicated between voice hooks | `useVoiceComposerInput.ts`, `useTaskVoiceCapture.ts` |
| 5 | 🟡 Medium | Dual stop buttons (toolbar + panel) | `tasks/index.tsx`, `VoiceRecordingPanel.tsx`, `ComposerToolbar.tsx` |
| 6 | 🟡 Medium | Stored derived error title/message | `useTaskVoiceCapture.ts`, `voiceComposerInput.helpers.ts` |
| 7 | 🟡 Medium | Untyped `as` cast on API response | `useVoiceTasks.ts` |
| 8 | 🟢 Low | Inconsistent error UX (Alert vs banner) | Composer vs Tasks screens |
| 9 | 🟢 Low | Magic string for native error codes | `VoiceTranscriberModule.swift`, both voice hooks |
