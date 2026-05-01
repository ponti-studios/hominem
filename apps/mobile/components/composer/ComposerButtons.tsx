import type { SFSymbol } from 'expo-symbols';
import React from 'react';
import { Pressable } from 'react-native';

import { makeStyles, spacing, useThemeColors } from '~/components/theme';
import AppIcon from '~/components/ui/icon';

const BTN_SIZE = spacing[6]; // 32px
const BTN_ICON_SIZE = spacing[4] + 2; // 18px
const MEDIA_BTN_SIZE = spacing[5] + 2; // 26px
const MEDIA_BTN_ICON_SIZE = spacing[4] + 4; // 20px

interface MediaButtonProps {
  icon: SFSymbol;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

export function MediaButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
}: MediaButtonProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.mediaBtn,
        disabled ? styles.mediaBtnDisabled : null,
        pressed ? styles.mediaBtnPressed : null,
      ]}
    >
      <AppIcon name={icon} size={MEDIA_BTN_ICON_SIZE} tintColor={themeColors['text-secondary']} />
    </Pressable>
  );
}

interface ActionButtonProps {
  icon: SFSymbol;
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}

export function ActionButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: ActionButtonProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.actionBtn,
        disabled ? styles.actionBtnDisabled : null,
        pressed && !disabled ? styles.actionBtnPressed : null,
      ]}
    >
      <AppIcon
        name={icon}
        size={BTN_ICON_SIZE}
        tintColor={disabled ? themeColors['text-tertiary'] : themeColors.white}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  mediaBtn: {
    width: MEDIA_BTN_SIZE,
    height: MEDIA_BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  mediaBtnDisabled: {
    opacity: 0.4,
  },
  mediaBtnPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  actionBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnPressed: {
    opacity: 0.7,
  },
}));
