import { Text, View } from 'react-native';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

interface StreamLoadErrorProps {
  onRetry: () => void;
}

export function StreamLoadError({ onRetry }: StreamLoadErrorProps) {
  const { eventCoral, eventForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    container: { alignItems: 'center', gap: 14, paddingHorizontal: 36, paddingTop: 72 },
    tile: {
      alignItems: 'center',
      backgroundColor: eventCoral,
      borderCurve: 'continuous',
      borderRadius: 40,
      height: 120,
      justifyContent: 'center',
      transform: [{ rotate: '-6deg' }],
      width: 120,
    },
    title: {
      color: theme.colors.foreground,
      fontFamily: fontFamilies.sans,
      fontSize: 26,
      fontWeight: '800',
      marginTop: 8,
      textAlign: 'center',
    },
    description: {
      color: theme.colors.mutedForeground,
      fontFamily: fontFamilies.sans,
      fontSize: 16,
      lineHeight: 22,
      maxWidth: 290,
      textAlign: 'center',
    },
  }));

  return (
    <View style={styles.container} testID="stream-load-error">
      <View style={styles.tile}>
        <AppIcon name="wifi.exclamationmark" size={48} tintColor={eventForeground} />
      </View>
      <Text style={styles.title}>{t.stream.loadError.title}</Text>
      <Text style={styles.description}>{t.stream.loadError.description}</Text>
      <Button label={t.stream.loadError.retry} onPress={onRetry} variant="primary" />
    </View>
  );
}
