# Composer: Accessibility

## Interactive element labeling

Every tappable element in the composer has an `accessibilityLabel` and `accessibilityRole`:

| Element | Label | Role |
|---|---|---|
| Send button | `'Sending…'` (in-flight) or `presentation.primaryActionLabel` | `'button'` |
| Plus button | `'Add attachment'` | `'button'` |
| Voice button | `'Record a voice message'` | `'button'` |
| Secondary action | `presentation.secondaryActionLabel ?? 'Start chat'` | `'button'` |
| Attachment thumbnail | `'Remove <filename>'` | `'button'` |
| Note chip remove | `'Remove <title>'` | `'button'` |
| Mention suggestion | `'Link <title>'` | `'button'` |
| Voice start | `'Start voice recording'` | `'button'` |
| Voice stop | `'Stop recording'` | `'button'` |
| Close voice modal | `'Close voice input'` | `'button'` |
| Close camera | `'Close camera'` | `'button'` |
| Flip camera | `'Flip camera'` | — (no role set) |
| Take photo | `'Take photo'` | — (no role set) |

## Disabled state semantics

The send button passes `disabled={!canSubmit || isChatSending}` directly to `Pressable`. React Native exposes this to VoiceOver as an unavailable button when disabled.

Secondary buttons pass `disabled={isChatSending}`, preventing interaction while a send is in progress.

## Hit slop

`SecondaryButton` uses `hitSlop={spacing[2]}` (~8px) to extend the touch target beyond the visual bounds of the small 26px button. This helps users with motor impairments tap small controls accurately.

## Accessibility hints

`VoiceInput` provides `accessibilityHint` in addition to labels:

```tsx
accessibilityHint={
  isRecording ? 'Tap to stop and transcribe' : 'Tap to record a voice message'
}
```

## Reduced motion

All entering, exiting, and layout animations respect the system "Reduce Motion" preference via `useReducedMotion`. When reduced motion is enabled, all Reanimated entering/exiting/layout animations are disabled — components appear and disappear instantly.

The `useReducedMotion` hook is a singleton that subscribes to `AccessibilityInfo` changes and re-evaluates live:

```ts
AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
  reducedMotionSnapshot = value;
  emitReducedMotionChange();
});
```

This means if the user toggles the system preference while the app is open, the animations update immediately without a restart.

## TextInput testIDs

The text input has `testID="mobile-composer-input"` for UI testing and `ref={inputRef}` for programmatic focus. Mention suggestion items have `testID="mobile-composer-mention-<noteId>"` for per-item targeting in tests.
