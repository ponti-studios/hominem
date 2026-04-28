import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import AppIcon from '~/components/ui/icon';

// ── Constants ─────────────────────────────────────────────────────────────────

const BTN = 32;
const ICON = 18;

// ── Component ─────────────────────────────────────────────────────────────────

interface GlassActionButtonProps {
  onSave: () => void;
  onChat: () => void;
  disabled?: boolean;
}

export function GlassActionButton({ onSave, onChat, disabled = false }: GlassActionButtonProps) {
  const themeColors = useThemeColors();
  const iconColor = disabled ? themeColors['text-tertiary'] : '#ffffff';

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Open chat"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={onChat}
        style={({ pressed }) => [styles.iconButton, pressed && !disabled ? styles.pressed : null]}
      >
        <AppIcon name="bubble.left" size={ICON} tintColor={iconColor} />
      </Pressable>
      <Pressable
        accessibilityLabel="Save note"
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={onSave}
        style={({ pressed }) => [styles.iconButton, pressed && !disabled ? styles.pressed : null]}
      >
        <AppIcon name="arrow.up" size={ICON} tintColor={iconColor} />
      </Pressable>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: BTN,
    paddingHorizontal: 4,
  },
  iconButton: {
    alignItems: 'center',
    height: BTN,
    justifyContent: 'center',
    width: BTN,
  },
  pressed: {
    opacity: 0.7,
  },
});
