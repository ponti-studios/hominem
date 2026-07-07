import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import t from '~/translations';

interface InlineErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function InlineErrorBanner({ message, onDismiss }: InlineErrorBannerProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text color="destructive" onPress={onDismiss}>
        {`${message} · ${t.inboxComposer.composer.dismissErrorHint}`}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    borderTopColor: theme.colors['border-subtle'],
    borderTopWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
}));
