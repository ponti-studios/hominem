import type { RelativePathString } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '~/components/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';

export default function NotFoundScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.host}>
        <View style={styles.content}>
          <AppIcon name="questionmark.circle" size={32} tintColor={themeColors['text-secondary']} />
          <Text style={[styles.title, { color: themeColors.foreground }]}>Resource not found</Text>
          <Text style={[styles.message, { color: themeColors['text-secondary'] }]}>
            The page you opened is not available.
          </Text>
          <Button
            label="Return to root"
            onPress={() => {
              router.replace('/' as RelativePathString);
            }}
            variant="primary"
          />
        </View>
      </View>
    </>
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
