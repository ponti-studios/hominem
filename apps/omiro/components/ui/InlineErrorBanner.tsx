import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

interface InlineErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function InlineErrorBanner({ message, onDismiss, onRetry }: InlineErrorBannerProps) {
  const theme = useAppTheme();
  const styles = useStyles((theme) => ({
    banner: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingLeft: 12,
      paddingRight: 4,
      paddingVertical: 4,
    },
    message: { ...theme.textVariants.footnote, flex: 1, color: theme.colors.destructive },
    retry: { ...theme.textVariants.footnote, color: theme.colors.primary, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  }));

  return (
    <View style={[styles.banner, { borderCurve: 'continuous', boxShadow: theme.shadows.md }]}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
            <Text style={styles.retry}>{t.inboxComposer.composer.retry}</Text>
          </Pressable>
        ) : null}
        <IconButton
          accessibilityLabel={t.inboxComposer.composer.dismissErrorHint}
          onPress={onDismiss}
        >
          <AppIcon name="xmark" size={20} />
        </IconButton>
      </View>
    </View>
  );
}
