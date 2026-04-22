# Composer: Text Input

## Component

The `TextInput` is rendered inside `Composer.tsx` within an `Animated.View` whose height is spring-animated.

```tsx
<Animated.View style={[styles.inputSurface, inputStyle]}>
  <View style={styles.inputWrap}>
    <TextInput
      ref={inputRef}
      multiline
      value={message}
      onChangeText={setMessage}
      onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
      placeholder={presentation.placeholder}
      placeholderTextColor={theme.colors['text-tertiary']}
      cursorColor={theme.colors.accent}
      selectionColor={theme.colors.accent}
      style={styles.input}
      testID="mobile-composer-input"
      textAlignVertical="top"
      scrollEnabled={false}
    />
  </View>
</Animated.View>
```

## Auto-grow behavior

The input expands vertically as the user types, clamped between `INPUT_MIN_H` and `INPUT_MAX_H`.

```ts
const INPUT_MIN_H = spacing[6] + spacing[4]; // ~48px
const INPUT_MAX_H = spacing[6] * 9; // ~288px
```

`onContentSizeChange` fires on every text change. The new height is clamped and applied via a spring animation:

```ts
const onContentSizeChange = (h: number) => {
  const clamped = Math.min(Math.max(h, INPUT_MIN_H), INPUT_MAX_H);
  animatedH.value = withSpring(clamped, {
    damping: 20,
    stiffness: 220,
    mass: 0.7,
    overshootClamping: false,
  });
};
```

The animated height is applied to the `inputSurface` container via `useAnimatedStyle`:

```ts
const inputStyle = useAnimatedStyle(() => ({
  flex: 1,
  minHeight: animatedH.value,
  maxHeight: animatedH.value,
}));
```

`scrollEnabled={false}` means the `TextInput` itself never scrolls — the animated container grows instead.

## Styling

```ts
input: {
  color: theme.colors.foreground,
  fontSize: theme.textVariants.callout.fontSize,    // 16px
  lineHeight: theme.textVariants.callout.lineHeight,
  letterSpacing: -0.1,
  paddingHorizontal: 0,
  paddingVertical: 0,
}
```

Horizontal padding is explicitly removed (`paddingHorizontal: 0`). The card provides outer padding (`paddingHorizontal: spacing[1]`).

`textAlignVertical="top"` is Android-only and has no effect on iOS.

## Placeholder

The placeholder is route-aware and changes based on `ComposerPresentation.placeholder` from `deriveComposerPresentation`:

| Target  | Idle                                            | Recording      |
| ------- | ----------------------------------------------- | -------------- |
| `feed`  | `'Write a note, ask something, or drop a file'` | `'Listening…'` |
| `notes` | `'Write into your notes…'`                      | `'Listening…'` |
| `chat`  | `'Message'`                                     | `'Listening…'` |

## Value binding

`value` is bound to `message` from `useComposerContext()`. `onChangeText` calls `setMessage` which writes to the active draft via `updateDraft`.

## Ref

`inputRef` is a `useRef<TextInput>` used to programmatically focus the input after a mention is selected (so the keyboard stays open during selection).

## canSubmit

The send button is enabled based on `canSubmitComposerDraft` from `composerActions.ts`:

```ts
function canSubmitComposerDraft({ isUploading, message, uploadedAttachmentIds, selectedNotes }) {
  return (
    !isUploading &&
    (message.trim().length > 0 || uploadedAttachmentIds.length > 0 || selectedNotes.length > 0)
  );
}
```

The composer can be submitted with text, uploaded files, or selected notes — any one of the three is sufficient.
