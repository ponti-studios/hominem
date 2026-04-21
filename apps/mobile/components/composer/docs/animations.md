# Composer: Animations

## Enter and exit

The outer shell `Animated.View` uses Reanimated entering/exiting animations from `notes-surface-motion.ts`:

```ts
<Animated.View
  entering={createNotesEnterLift(prefersReducedMotion)}
  exiting={createNotesExitLift(prefersReducedMotion)}
>
```

These are `FadeInDown` and `FadeOutDown` respectively, each using the shared `durations.enter` / `durations.exit` token from `@hakumi/ui/tokens`.

The composer enters/exits when `presentation.isHidden` changes — e.g. navigating to or from a settings page.

## Layout transitions

The card `Animated.View` and the attachments `Animated.View` both use `layout`:

```ts
layout={createNotesLayoutTransition(prefersReducedMotion)}
```

This is `LinearTransition.duration(durations.enter)`. It animates the card height when:
- Attachments are added or removed
- Note chips appear or disappear
- Mention suggestions open or close
- The text input grows

The attachment strip has its own nested `Animated.View` with the same layout transition so it animates independently from the card.

## Input height animation

The `TextInput` container height is driven by a `SharedValue` animated via `withSpring`:

```ts
const animatedH = useSharedValue(INPUT_MIN_H);

// On content size change:
animatedH.value = withSpring(clamped, {
  damping: 20,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: false,
});
```

The spring configuration produces a natural, slightly bouncy feel without overshoot when reducing (the spring overshoots slightly when growing, which is intentional).

## Reduced motion

All animations respect the system "Reduce Motion" accessibility preference. `useReducedMotion` is a singleton external store that reads `AccessibilityInfo.isReduceMotionEnabled()` and subscribes to live changes:

```ts
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => reducedMotionSnapshot,
    () => false,
  );
}
```

When `prefersReducedMotion` is `true`, the helper functions return `undefined` instead of an animation:

```ts
export function createNotesEnterLift(reducedMotion: boolean) {
  return reducedMotion ? undefined : FadeInDown.duration(durations.enter);
}
```

Passing `undefined` to `entering`/`exiting`/`layout` disables those animations entirely.

## VoiceInput mic button animation

The mic/stop button background color is animated using Reanimated `interpolateColor`:

```ts
const recordingProgress = useDerivedValue(
  () => withTiming(isRecording ? 1 : 0, { duration: VOID_MOTION_DURATION_STANDARD }),
  [isRecording],
);

const speakButtonBackground = useAnimatedStyle(() => ({
  backgroundColor: interpolateColor(
    recordingProgress.value,
    [0, 1],
    [theme.colors.muted, theme.colors.destructive],
  ),
}));
```

The button transitions from muted grey to destructive red as recording starts.

## Waveform bars

Each `WaveformBar` uses `withTiming` to animate height:

```ts
height: withTiming(isActive ? Math.max(4, level * 60) : 4, {
  duration: 100,
  easing: Easing.out(Easing.ease),
})
```

100ms timing with ease-out easing keeps the bars responsive to audio level changes without jitter.
