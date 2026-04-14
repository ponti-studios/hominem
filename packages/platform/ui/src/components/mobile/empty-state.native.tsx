import { SymbolView, type SFSymbol } from 'expo-symbols';
import { FadeIn } from 'react-native-reanimated';
import Reanimated from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

import { radiiNative, spacing, colors } from '../../tokens';
import { Button } from '../ui/button.native';
import { Text } from '../typography/text.native';

const DEFAULT_BOTTOM_OFFSET = spacing[7] * 3;
const ICON_RING_SIZE = spacing[7] + spacing[3];
const ICON_SIZE = spacing[4] + spacing[2];

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
  return (
    <Reanimated.View entering={FadeIn.duration(280)} style={[styles.container, { paddingBottom: bottomOffset }]}>
      <View style={styles.iconRing}>
        <SymbolView name={sfSymbol} size={ICON_SIZE} tintColor={colors['text-tertiary']} />
      </View>
      <Text color="foreground" style={styles.title} variant="headline">
        {title}
      </Text>
      {description ? (
        <Text color="text-tertiary" style={styles.description} variant="subhead">
          {description}
        </Text>
      ) : null}
      {action ? (
        <Button onPress={action.onPress} size="sm" style={styles.action} variant="outline">
          {action.label}
        </Button>
      ) : null}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing[2],
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  iconRing: {
    alignItems: 'center',
    backgroundColor: colors['bg-elevated'],
    borderRadius: radiiNative.full,
    height: ICON_RING_SIZE,
    justifyContent: 'center',
    marginBottom: spacing[2],
    width: ICON_RING_SIZE,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[2],
  },
});

export { EmptyState };
export type { EmptyStateProps };
