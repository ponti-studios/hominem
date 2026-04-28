import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';

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
        <AppIcon name="exclamationmark.triangle.fill" size={28} tintColor="#FF7B5C" />
        <Text style={[styles.title, { color: themeColors.foreground }]}>Something went wrong</Text>
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
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
