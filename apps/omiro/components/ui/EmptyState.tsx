import type { SFSymbol } from 'expo-symbols';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import {
  componentSizes,
  fontSizes,
  fontWeights,
  lineHeights,
  themeSpacing,
  useThemeColors,
} from '../theme';
import { Button } from './button';
import AppIcon from './icon';

const DEFAULT_BOTTOM_OFFSET = themeSpacing.xl * 3;

interface EmptyStateProps {
  action?: { label: string; onPress: () => void };
  bottomOffset?: number;
  imageSource?: ImageSourcePropType;
  sfSymbol?: SFSymbol;
  title: string;
}

function EmptyState({
  action,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  imageSource,
  sfSymbol,
  title,
}: EmptyStateProps) {
  const themeColors = useThemeColors();

  return (
    <Reanimated.View
      entering={FadeIn.duration(280)}
      style={[styles.container, { paddingBottom: bottomOffset }]}
    >
      <View style={styles.content}>
        {imageSource ? (
          <Image accessibilityIgnoresInvertColors source={imageSource} style={styles.asset} />
        ) : sfSymbol ? (
          <AppIcon
            name={sfSymbol}
            size={componentSizes.lg}
            tintColor={themeColors['text-secondary']}
          />
        ) : null}
        <Text style={[styles.title, { color: themeColors['text-primary'] }]}>{title}</Text>
        {action ? (
          <Button label={action.label} onPress={action.onPress} variant="secondary" />
        ) : null}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  asset: {
    height: 112,
    resizeMode: 'contain',
    width: 112,
  },
  content: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: themeSpacing.md,
    paddingHorizontal: themeSpacing.xl,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSizes.subhead,
    lineHeight: lineHeights.readable,
    textAlign: 'center',
  },
});

export { EmptyState };
export type { EmptyStateProps };
