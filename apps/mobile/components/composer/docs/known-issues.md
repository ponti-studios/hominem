# Composer: Known Issues

A catalogue of confirmed bugs, dead code, and architectural inconsistencies, ordered by severity.

---

## Critical

### 1. Voice modal never renders

**File**: `Composer.tsx:335`, `voice-session-modal.tsx:34`

`isVoiceOpen` is initialized to `false` and never set to `true`. The voice button calls `voiceModalRef.current?.present()` but `VoiceSessionModal` has a guard:

```ts
if (!visible) return null;
```

Since `visible={isVoiceOpen}` is always `false`, the modal component never mounts. The `BottomSheetModal` ref inside it is never created, so `voiceModalRef.current?.present()` calls into `null`.

**Fix**: Remove the `visible` prop pattern. Control the modal only via the imperative `bottomSheetModalRef`.

---

### 2. Double keyboard compensation

**File**: `app/(protected)/_layout.tsx`, `Composer.tsx:395`

The protected layout wraps all content in `KeyboardAvoidingView behavior="padding"` on iOS. The composer also applies a manual bottom offset via `useAnimatedKeyboard().height.value`. Both mechanisms respond to the same keyboard event, causing the composer to overshoot — moving up twice as far as intended when the keyboard opens.

**Fix**: Remove the `KeyboardAvoidingView` from the parent layout, or exclude the composer from its effect.

---

### 3. Draft persistence not connected

**File**: `apps/mobile/hooks/use-draft-persistence.ts`

`use-draft-persistence.ts` implements full AsyncStorage-backed draft persistence with debounced save (5 seconds), restore on mount, and clear on submit. It is imported nowhere. Drafts are lost when the app is killed.

**Fix**: Wire `use-draft-persistence` into `ComposerContext` for each target key.

---

## High

### 4. Notes list uses hardcoded clearance constant

**File**: `app/(protected)/(tabs)/notes/index.tsx`

```ts
const COMPOSER_CLEARANCE = spacing[7] * 3; // hardcoded
```

The notes list does not consume `useComposerContext().composerClearance`, so its content padding does not adapt when the composer card grows (e.g., when attachments are added).

**Fix**: Replace the constant with `useComposerContext().composerClearance`.

---

### 5. `isVoiceOpen` local state is never used

**File**: `Composer.tsx:335`

`isVoiceOpen` is set to `false` in state, passed as `visible` to `VoiceSessionModal`, but the `setIsVoiceOpen(false)` calls in the close/transcribe callbacks are calls into a no-op since the modal never opened. The state serves no purpose.

**Fix**: Remove `isVoiceOpen` and all references to it after fixing issue #1.

---

### 6. `primaryActionLabel` placeholder is unfinished

**File**: `composerState.ts:147`

```ts
primaryActionLabel: hasText ? 'Send' : 'Send',
```

Both branches of the ternary are identical. This was likely intended to differentiate the label (e.g., `'Send'` vs `'Record'`) but was never completed.

**Fix**: Decide the intended behavior and implement it, or remove the ternary.

---

### 7. `AccessoryAction` component is dead code

**File**: `Composer.tsx:260`

`AccessoryAction` is a fully implemented `Pressable` + `Animated.Text` button component defined in `Composer.tsx`. It is never referenced in the JSX and has no callers.

**Fix**: Delete the component.

---

### 8. Sequential file uploads

**File**: `use-file-upload.ts:120`

`performMobileUploads` uses a `for...of await` loop, uploading files one at a time. For 5 files at 10MB each this is 5× slower than necessary.

```ts
for (const [index, asset] of assets.entries()) {
  // ... sequential awaits
}
```

**Fix**: Use `Promise.all` or `Promise.allSettled` to upload files concurrently.

---

### 9. No feedback on transcription failure

**File**: `voice-session-modal.tsx:67`

When `useTranscriber` fails, `onError()` is called which calls `handleDismiss()`. The modal closes with no explanation to the user. The error is swallowed after logging.

**Fix**: Show an inline error state with the error message and a retry button before dismissing.

---

### 10. Camera MIME type hardcoded to `image/jpeg`

**File**: `useComposerMediaActions.ts:132`

```ts
mimeType: 'image/jpeg',
```

`react-native-vision-camera` can capture HEIC on newer iPhones. The hardcoded JPEG MIME type may mismatch the actual file format, causing upload failures or incorrect server-side handling.

**Fix**: Infer the MIME type from the file URI extension or from `react-native-vision-camera` metadata.

---

## Medium

### 11. `ComposerDraft.isRecording` is ephemeral state in the draft

**File**: `composerState.ts:28`

`isRecording` is a boolean stored in `ComposerDraft` (the persistent per-target draft shape). Recording state is ephemeral — it should not be persisted per draft. If draft persistence is connected in the future, restoring `isRecording: true` with no active recorder would produce incorrect UI state.

**Fix**: Move `isRecording` and `mode` out of `ComposerDraft` into local component state or a separate non-draft context field.

---

### 12. `params` dependency in ComposerContext is fragile

**File**: `ComposerContext.tsx:63`

```ts
useMemo(
  () => resolveComposerTarget(pathname, params),
  [pathname, params.chatId, params.id],
);
```

`params` is destructured at the dependency level. If a new route parameter is introduced that affects target resolution, it must be manually added to this dependency array or `resolveComposerTarget` will receive stale values.

**Fix**: Pass only the specific values needed to `resolveComposerTarget` rather than the whole `params` object.

---

### 13. Mention trigger limited to slug-style names

**File**: `note-mentions.ts:2`

The regex `/(?:^|\s)#([a-z0-9-]+)$/i` only matches alphanumeric + hyphen slugs. Notes with spaces, apostrophes, or other punctuation in their titles cannot be found via `#mention`.

**Fix**: Expand the regex or implement a different trigger mechanism (e.g., show suggestions on any `#` regardless of what follows).

---

### 14. `CameraModal.bottomSheetModalRef` is never passed from Composer

**File**: `Composer.tsx:510`

```tsx
<CameraModal
  visible={isCameraOpen}
  onCapture={...}
  onClose={() => setIsCameraOpen(false)}
  // bottomSheetModalRef not passed
/>
```

`CameraModal`'s `handleDismiss` calls `bottomSheetModalRef?.current?.dismiss()` which is a no-op. The modal closes correctly via the `visible` prop but the architecture is inconsistent with how `VoiceSessionModal` is intended to work.

**Fix**: Either pass a ref to `CameraModal` and control it imperatively, or remove the `bottomSheetModalRef` prop from `CameraModal` entirely and rely solely on `visible`.

---

### 15. No per-file upload progress indicator

**File**: `Composer.tsx`, `use-file-upload.ts`

`useFileUpload` tracks a single global `isUploading` boolean and a single `progress` number (0–100 across all files). Individual attachment thumbnails show only a semi-transparent dim overlay with no progress bar or percentage.

**Fix**: Track per-attachment upload progress and render a progress indicator on each thumbnail.

---

## Low

### 16. `WaveformBar` uses index as key

**File**: `WaveformVisualizer.tsx:29`

```tsx
bars.map((level, index) => <WaveformBar key={`bar-${index}`} .../>)
```

Keys are stable by position but not by identity. Acceptable for animations but prevents React from tracking bar identity as the buffer slides.

---

### 17. `textAlignVertical="top"` has no effect on iOS

**File**: `Composer.tsx:466`

This prop is Android-only. On iOS, multiline `TextInput` already aligns text to the top.

---

### 18. `legacy/` and `singularity/hooks/` are empty directories

**File**: `apps/mobile/components/legacy/`, `apps/mobile/singularity/hooks/`

Vestigial scaffolding from a prior refactor. No files, no purpose.

**Fix**: Delete the empty directories.

---

### 19. Intent donation has no platform guard

**File**: `useComposerSubmission.ts:119`

`donateAddNoteIntent()` is called after note creation with no `Platform.OS === 'ios'` guard visible at the call site. If the implementation is not already platform-safe, this could throw on Android.

**Fix**: Verify the implementation is guarded, or add a guard at the call site.

---

### 20. `use-file-upload.ts` `fetch` is not injectable

**File**: `use-file-upload.ts:103`

`readLocalAssetBlob` takes a `fetchImpl` parameter but `useFileUpload` always uses `global.fetch`. The upload function cannot be mocked in unit tests without patching the global.

**Fix**: Accept `fetchImpl` as a parameter or inject it via a service pattern.
