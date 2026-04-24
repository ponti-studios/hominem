import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

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
  return (
    <SwiftUIHost style={styles.host} useViewportSizeMeasurement>
      <VStack
        alignment="center"
        spacing={12}
        modifiers={[frame({ maxWidth: 360 }), padding({ all: 24 })]}
      >
        <SwiftUIImage systemName="exclamationmark.triangle.fill" size={28} color="#FF7B5C" />
        <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
          Something went wrong
        </SwiftUIText>
        <SwiftUIText
          modifiers={[
            font({ size: 16 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          {message}
        </SwiftUIText>
        <SwiftUIButton
          label={actionLabel}
          onPress={onPress}
          modifiers={[
            buttonStyle('borderedProminent'),
            frame({ maxWidth: Number.POSITIVE_INFINITY }),
          ]}
        />
      </VStack>
    </SwiftUIHost>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
