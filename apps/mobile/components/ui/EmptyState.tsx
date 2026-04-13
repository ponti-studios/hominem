import { radiiNative, spacing } from '@hominem/ui/tokens';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { Text, theme } from '~/components/theme';
import { Button } from '~/components/Button';

// Default composer clearance
const DEFAULT_BOTTOM_OFFSET = spacing[7] * 3; // 144

const ICON_RING_SIZE = spacing[7] + spacing[3]; // 60
const ICON_SIZE = spacing[4] + spacing[2];      // 24

interface EmptyStateProps {
  /** SF Symbol name, e.g. 'note.text' */
  sfSymbol: string;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  /** Bottom padding to clear floating UI. Defaults to 144. */
  bottomOffset?: number;
}

export function EmptyState({
  sfSymbol,
  title,
  description,
  action,
  bottomOffset = DEFAULT_BOTTOM_OFFSET,
}: EmptyStateProps) {
  return (
    <Reanimated.View
      entering={FadeIn.duration(280)}
      style={[styles.container, { paddingBottom: bottomOffset }]}
    >
      <View style={styles.iconRing}>
        <Image
          source={`sf:${sfSymbol}`}
          style={styles.icon}
          tintColor={theme.colors['text-tertiary']}
          contentFit="contain"
        />
      </View>

      <Text style={styles.title}>{title}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      {action ? (
        <Button
          variant="outline"
          size="sm"
          onPress={action.onPress}
          style={styles.action}
        >
          {action.label}
        </Button>
      ) : null}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
  iconRing: {
    width: ICON_RING_SIZE,
    height: ICON_RING_SIZE,
    borderRadius: radiiNative.full,
    backgroundColor: theme.colors['bg-elevated'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors['text-tertiary'],
    textAlign: 'center',
  },
  action: {
    marginTop: spacing[2],
  },
});
