import { StyleSheet, Text, View } from 'react-native';

import {
  componentSizes,
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  lineHeights,
  themeSpacing,
  useThemeColors,
} from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';

interface ErrorFallbackProps {
  title: string;
  titleSize?: 'title1' | 'title2';
  message: string;
  debugMessage?: string;
  actionLabel: string;
  onAction: () => void;
  buttonVariant?: 'primary' | 'secondary';
}

export function ErrorFallback({
  title,
  titleSize = 'title1',
  message,
  debugMessage,
  actionLabel,
  onAction,
  buttonVariant = 'primary',
}: ErrorFallbackProps) {
  const themeColors = useThemeColors();

  return (
    <View style={styles.host}>
      <View style={styles.content}>
        <AppIcon
          name="exclamationmark.triangle.fill"
          size={componentSizes.lg}
          tintColor={themeColors.destructive}
        />
        <Text
          style={[styles.title, { fontSize: fontSizes[titleSize], color: themeColors.foreground }]}
        >
          {title}
        </Text>
        <Text style={[styles.message, { color: themeColors['text-secondary'] }]}>{message}</Text>

        {__DEV__ && debugMessage ? (
          <Text style={[styles.debugMessage, { color: themeColors['text-tertiary'] }]}>
            {debugMessage}
          </Text>
        ) : null}

        <Button label={actionLabel} onPress={onAction} variant={buttonVariant} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: themeSpacing.md,
  },
  title: {
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  debugMessage: {
    fontSize: fontSizes.caption1,
    lineHeight: lineHeights.footnote,
    fontFamily: fontFamiliesNative.mono,
    textAlign: 'center',
  },
});
