import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { makeStyles, shadowsNative, useThemeColors } from '~/components/theme';
import t from '~/translations';

interface ComposerRestingProps {
  onActivate: () => void;
  disabled?: boolean;
}

export function ComposerResting({ onActivate, disabled = false }: ComposerRestingProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.surface, { marginBottom: bottom }]}>
      <ComposerMedia accessibilityLabel={t.feed.composer.addAttachmentA11y} disabled={disabled} />
      <Pressable
        onPress={onActivate}
        disabled={disabled}
        accessibilityLabel={t.feed.composer.placeholder}
        accessibilityRole="button"
        accessibilityHint="Tap to start writing a note"
        style={styles.placeholder}
      >
        <Text
          style={[styles.placeholderText, { color: themeColors['text-tertiary'] }]}
          numberOfLines={1}
        >
          {t.feed.composer.placeholder}
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    ...shadowsNative.low,
    alignItems: 'center',
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.xl,
    borderWidth: 1,
    elevation: 6,
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    width: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  placeholderText: {
    fontSize: 16,
    lineHeight: 22,
  },
}));
