# Composer: Keyboard Handling

## Approach

The composer uses `useAnimatedKeyboard` from `react-native-keyboard-controller` to track keyboard height on the UI thread. This avoids the frame delay and jank associated with `KeyboardAvoidingView`.

## Shell bottom offset

The outer `Animated.View` shell is positioned absolutely. Its `bottom` is computed in an animated style:

```ts
const keyboard = useAnimatedKeyboard();
const insets = useSafeAreaInsets();

const shellStyle = useAnimatedStyle(() => ({
  bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
}));
```

`keyboard.height.value` is a Reanimated `SharedValue<number>` that updates on the UI thread as the keyboard appears and disappears. The safe area bottom inset is respected with a minimum gap of `spacing[2]`.

## Why not KeyboardAvoidingView

`useAnimatedKeyboard` gives:
- UI thread updates (no JS bridge round-trip)
- Smoother animation in sync with the keyboard animation curve
- Direct control over the exact offset formula

`KeyboardAvoidingView` with `behavior="padding"` adds padding to the parent view, which shifts all content. The composer needs precise control over its own position as a floating element.

## Double compensation issue

The parent layout at `app/(protected)/_layout.tsx` wraps all content in a `KeyboardAvoidingView` with `behavior="padding"` on iOS. The composer also applies its own keyboard offset. These two mechanisms compound:

1. `KeyboardAvoidingView` pushes the parent view up by the keyboard height
2. The composer's animated `bottom` also moves up by `keyboard.height.value`

The net result is that the composer overshoots — it moves up twice as far as it should when the keyboard is open. This is a known bug. See [known-issues.md](./known-issues.md#3-double-keyboard-compensation).

## Safe area handling

`useSafeAreaInsets()` provides the bottom inset (home indicator height on notchless iPhones). The composer uses:

```ts
Math.max(insets.bottom, spacing[2])
```

This ensures a minimum gap from the bottom edge even on devices with no bottom inset.

The same formula is used when publishing `composerClearance` to context:

```ts
onLayout={(event) => {
  setComposerClearance(
    event.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]),
  );
}}
```
