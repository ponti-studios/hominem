import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { spacing } from '../theme';

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
  return (
    <Reanimated.View
      entering={FadeIn.duration(280)}
      style={[styles.container, { paddingBottom: bottomOffset }]}
    >
      <SwiftUIHost matchContents style={styles.host}>
        <VStack
          alignment="center"
          spacing={10}
          modifiers={[frame({ maxWidth: 320 }), padding({ horizontal: spacing[6] })]}
        >
          <SwiftUIImage
            systemName={sfSymbol}
            size={28}
            color="#8E8E93"
            modifiers={[padding({ bottom: 8 })]}
          />
          <SwiftUIText modifiers={[font({ size: 18, weight: 'semibold' })]}>{title}</SwiftUIText>
          {description ? (
            <SwiftUIText
              modifiers={[
                font({ size: 15 }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {description}
            </SwiftUIText>
          ) : null}
          {action ? (
            <SwiftUIButton
              label={action.label}
              onPress={action.onPress}
              modifiers={[buttonStyle('bordered'), padding({ top: 8 })]}
            />
          ) : null}
        </VStack>
      </SwiftUIHost>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  host: {
    alignSelf: 'stretch',
  },
});

export { EmptyState };
export type { EmptyStateProps };
