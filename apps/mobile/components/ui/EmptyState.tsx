import type { SFSymbol } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { spacing } from '../theme';
import { useThemeColors } from '../theme/theme';
import { Button } from './button';
import AppIcon from './icon';

const DEFAULT_BOTTOM_OFFSET = spacing[7] * 3;

interface EmptyStateProps {
  action?: { label: string; onPress: () => void } | undefined;
  bottomOffset?: number | undefined;
  description?: string | undefined;
  sfSymbol: SFSymbol;
  title: string;
}

function EmptyState({
  action,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
  description,
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
        <AppIcon color={themeColors['icon-secondary']} name={sfSymbol} size={28} />
        <Text style={[styles.title, { color: themeColors.foreground }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: themeColors['text-secondary'] }]}>
            {description}
          </Text>
        ) : null}
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
  content: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing[6],
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});

export { EmptyState };
export type { EmptyStateProps };
