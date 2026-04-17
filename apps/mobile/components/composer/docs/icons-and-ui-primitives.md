# Composer: Icons and UI Primitives

## AppIcon

`components/ui/icon.tsx` is the single icon component used throughout the composer.

```ts
interface IconProps {
  color?: string;
  name: SFSymbol;   // from expo-symbols
  size?: number;    // default 24
}

const AppIcon = ({ color, name, size = 24 }: IconProps) => (
  <SymbolView
    name={name}
    size={size}
    tintColor={color ?? theme.colors['icon-primary']}
  />
);
```

`SymbolView` is from `expo-symbols`, which renders native iOS SF Symbols. `SFSymbol` is the type exported by `expo-symbols` covering all valid symbol names.

**iOS only**: SF Symbols are a native iOS API. `expo-symbols` has no Android implementation. All icons in the composer render nothing on Android.

## SF Symbols used in the composer

| Symbol            | Usage                                               |
| ----------------- | --------------------------------------------------- |
| `arrow.up`        | Send button                                         |
| `plus`            | Attachment button                                   |
| `waveform`        | Voice recording button                              |
| `bubble.left`     | Secondary action (start chat) / note chip icon      |
| `xmark`           | Remove attachment / remove note chip / close modals |
| `mic`             | Voice input: idle state                             |
| `stop.fill`       | Voice input: recording state                        |
| `clock`           | Voice input: pause button                           |
| `arrow.clockwise` | Voice input: resume button                          |
| `camera.rotate`   | Camera modal: flip camera                           |

## SendButton

```tsx
function SendButton({ onPress, disabled, accessibilityLabel }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.sendBtn,
        disabled ? styles.sendBtnDisabled : null,
        pressed && !disabled ? styles.sendBtnPressed : null,
      ]}
    >
      <AppIcon
        name="arrow.up"
        size={SEND_ICON_SIZE}
        color={disabled ? theme.colors['text-tertiary'] : theme.colors['bg-base']}
      />
    </Pressable>
  );
}
```

Sizes:

- Button: `SEND_BTN_SIZE = spacing[6]` (~32px), circular
- Icon: `SEND_ICON_SIZE = spacing[4] + 2` (~18px)

States:

- **Enabled**: `backgroundColor: theme.colors.foreground` (filled), icon in `bg-base`
- **Disabled**: `backgroundColor: theme.colors['bg-base']`, `borderWidth: 1`, icon in `text-tertiary`
- **Pressed**: `opacity: 0.7`

## SecondaryButton

```tsx
function SecondaryButton({ icon, onPress, accessibilityLabel, disabled }) {
  return (
    <Pressable hitSlop={spacing[2]} style={...}>
      <AppIcon name={icon} size={SECONDARY_ICON_SIZE} color={theme.colors['text-secondary']} />
    </Pressable>
  );
}
```

Sizes:

- Button: `SECONDARY_BTN_SIZE = spacing[5] + 2` (~26px)
- Icon: `SECONDARY_ICON_SIZE = spacing[4] + 4` (~20px)

States:

- **Pressed**: `backgroundColor: theme.colors['bg-surface']`
- **Disabled**: `opacity: 0.4`

`hitSlop={spacing[2]}` extends the touch target by ~8px on all sides to improve tappability on small buttons.

## AccessoryAction

A text-label button (`Pressable` + `Animated.Text`) defined in `Composer.tsx`. Currently unused — it is never rendered in the JSX. Dead code.

## Theme tokens used

| Token                            | Role                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `theme.colors.foreground`        | Send button background (enabled); input text                 |
| `theme.colors['bg-base']`        | Send button background (disabled); send icon color (enabled) |
| `theme.colors['bg-elevated']`    | Card background                                              |
| `theme.colors['bg-surface']`     | Secondary button pressed background; attachment placeholder  |
| `theme.colors['text-secondary']` | Secondary button icon color                                  |
| `theme.colors['text-tertiary']`  | Placeholder text; send icon color (disabled)                 |
| `theme.colors.accent`            | Input cursor and selection color                             |
| `theme.colors.destructive`       | Error text; recording button (active)                        |
| `theme.colors['border-default']` | Send button border (disabled); selection chip border         |
| `radii.md`                       | Card, secondary button, attachment thumbnail border radius   |
| `radii.sm`                       | Send button, selection chip border radius                    |
| `shadowsNative.low`              | Card drop shadow                                             |
