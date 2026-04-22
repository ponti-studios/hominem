import { Image } from 'expo-image';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';

import { useSharedStyles } from '../theme/styles';

interface DangerZoneProps {
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export function DangerZone({ onSignOut, onDeleteAccount }: DangerZoneProps) {
  const themeColors = useThemeColors();
  const styles = useSharedStyles();

  return (
    <View style={styles.dangerZone}>
      <Pressable
        onPress={onSignOut}
        style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
        testID="settings-sign-out"
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Image
          source="sf:rectangle.portrait.and.arrow.right"
          style={styles.dangerIcon}
          tintColor={themeColors.destructive}
          contentFit="contain"
        />
        <Text style={styles.dangerLabel}>Sign out</Text>
      </Pressable>

      <Pressable
        onPress={onDeleteAccount}
        style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
      >
        <Image
          source="sf:trash"
          style={styles.dangerIcon}
          tintColor={themeColors['text-tertiary']}
          contentFit="contain"
        />
        <Text style={[styles.dangerLabel, styles.dangerLabelMuted]}>Delete account</Text>
      </Pressable>
    </View>
  );
}
