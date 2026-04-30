import { StyleSheet, Text, View } from 'react-native';

import {
  componentSizes,
  fontSizes,
  fontWeights,
  lineHeights,
  themeSpacing,
  useThemeColors,
} from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

interface FullScreenErrorFallbackProps {
  actionLabel: string;
  message: string;
  onPress: () => void;
}

export function FullScreenErrorFallback({
  actionLabel,
  message,
  onPress,
}: FullScreenErrorFallbackProps) {
  const themeColors = useThemeColors();

  return (
    <View style={styles.host}>
      <View style={styles.content}>
        <AppIcon
          name="exclamationmark.triangle.fill"
          size={componentSizes.lg}
          tintColor="#FF7B5C"
        />
        <Text style={[styles.title, { color: themeColors.foreground }]}>
          {t.errors.somethingWentWrong}
        </Text>
        <Text style={[styles.message, { color: themeColors['text-secondary'] }]}>{message}</Text>
        <Button label={actionLabel} onPress={onPress} variant="primary" />
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
    fontSize: fontSizes.title1,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSizes.md,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
});
