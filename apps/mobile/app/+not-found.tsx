import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <SwiftUIHost style={styles.host} useViewportSizeMeasurement>
        <VStack
          alignment="center"
          spacing={12}
          modifiers={[frame({ maxWidth: 360 }), padding({ all: 24 })]}
        >
          <SwiftUIImage systemName="questionmark.circle" size={32} color="#8E8E93" />
          <SwiftUIText modifiers={[font({ size: 28, weight: 'bold' })]}>
            Resource not found
          </SwiftUIText>
          <SwiftUIText
            modifiers={[
              font({ size: 16 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            The page you opened is not available.
          </SwiftUIText>
          <SwiftUIButton
            label="Return to root"
            onPress={() => {
              router.replace('/' as RelativePathString);
            }}
            modifiers={[
              buttonStyle('borderedProminent'),
              frame({ maxWidth: Number.POSITIVE_INFINITY }),
            ]}
          />
        </VStack>
      </SwiftUIHost>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
