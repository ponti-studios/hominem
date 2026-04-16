# Composer: Clearance System

## Purpose

The composer floats above all screen content. Without coordination, it would cover the bottom of chat message lists, note lists, and other scrollable content. The clearance system solves this by measuring the composer card height and publishing it to context so screens can pad their content accordingly.

## How it works

### 1. Composer measures itself

The card `Animated.View` has an `onLayout` handler:

```ts
onLayout={(event) => {
  setComposerClearance(
    event.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]),
  );
}}
```

`composerClearance` = card height + bottom inset gap. This value grows dynamically when attachments are added, note chips appear, or the text input expands.

### 2. Clearance is published to context

`setComposerClearance` is a state setter in `ComposerContext`. Any component that calls `useComposerContext()` can read `composerClearance`.

### 3. Clearance is reset when hidden

Two effects in `Composer.tsx` reset clearance to `0`:

```ts
useEffect(() => {
  if (presentation.isHidden) {
    setComposerClearance(0);
  }
}, [presentation.isHidden, setComposerClearance]);

useEffect(() => () => setComposerClearance(0), [setComposerClearance]);
```

The first resets when the route changes to a hidden target. The second resets on unmount.

## Consumer: chat screen

`app/(protected)/(tabs)/chat/[id].tsx` reads `composerClearance` from context and uses it as content padding:

```ts
const { composerClearance } = useComposerContext();
// ...
contentContainerStyle={{ paddingBottom: composerClearance }}
```

This is dynamic — when the user adds attachments and the card grows, the list automatically gains more padding.

## Consumer: notes list

`app/(protected)/(tabs)/notes/index.tsx` uses a hardcoded constant instead of reading from context:

```ts
const COMPOSER_CLEARANCE = spacing[7] * 3;
```

This does not adapt when the composer card size changes (e.g. attachments added). This is a known issue. See [known-issues.md](./known-issues.md#4-notes-list-uses-hardcoded-clearance-constant).

## Clearance timing

`onLayout` fires after the React render and native layout pass. There may be a single frame where the card is rendered but clearance has not yet been applied to the consumer screen. In practice this is not visible because the list content is already present before the composer grows.
