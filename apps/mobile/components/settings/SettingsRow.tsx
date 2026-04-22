import { Image } from 'expo-image';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text, theme } from '~/components/theme';

import { styles } from '../styles';

interface SettingsRowProps {
  leading?: React.ReactNode;
  sf?: string;
  sfColor?: string;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  leading,
  sf,
  sfColor,
  label,
  sublabel,
  trailing,
  onPress,
  destructive = false,
  disabled = false,
}: SettingsRowProps) {
  const labelColor = destructive ? theme.colors.destructive : theme.colors.foreground;

  const inner = (
    <View style={styles.row}>
      {leading ??
        (sf ? (
          <View
            style={[
              styles.rowIconWrap,
              { backgroundColor: sfColor ?? theme.colors['bg-elevated'] },
            ]}
          >
            <Image
              source={`sf:${sf}`}
              style={styles.rowIcon}
              tintColor={destructive ? theme.colors.destructive : theme.colors['icon-primary']}
              contentFit="contain"
            />
          </View>
        ) : null)}
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {trailing !== undefined ? (
        <View style={styles.rowTrailing}>{trailing}</View>
      ) : onPress ? (
        <Image
          source="sf:chevron.right"
          style={styles.chevron}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowPressable, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.rowPressable}>{inner}</View>;
}
