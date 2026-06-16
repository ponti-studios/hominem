import type { RelativePathString } from 'expo-router';
import { Stack, useRouter } from 'expo-router';
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

export default function NotFoundScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();

  return (
    <>
      <Stack.Screen options={{ title: t.errors.notFound.screenTitle }} />
      <View style={styles.host}>
        <View style={styles.content}>
          <AppIcon
            name="questionmark.circle"
            size={componentSizes.lg}
            tintColor={themeColors['text-secondary']}
          />
          <Text style={[styles.title, { color: themeColors.foreground }]}>
            {t.errors.notFound.title}
          </Text>
          <Text style={[styles.message, { color: themeColors['text-secondary'] }]}>
            {t.errors.notFound.message}
          </Text>
          <Button
            label={t.errors.notFound.returnToRoot}
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
