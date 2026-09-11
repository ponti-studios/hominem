import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useStyles } from '~/components/theme';
import t from '~/translations';

import type { StreamFilter } from './StreamScreen';

const omiroFloat = require('~/assets/images/omiro-float.webp');

// Mirrors the web `omiro-float` keyframes (apps/web/app/app.css): translateY
// 0 -> -5 -> 0 over a 4s ease-in-out cycle, looped forever.
function FloatingOmiro() {
  const styles = useStyles(() => ({ image: { width: 128, height: 117 } }));

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      {
        // reverse: true auto-reverses this same eased timing rather than
        // chaining a separate return-trip animation, which is what kept the
        // upward half of the loop from matching the downward half's easing.
        translateY: withRepeat(
          withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      },
    ],
  }));

  return (
    <Reanimated.View style={floatStyle}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="contain"
        source={omiroFloat}
        style={styles.image}
      />
    </Reanimated.View>
  );
}

interface StreamEmptyStateProps {
  filter: StreamFilter;
}

export function StreamEmptyState({ filter }: StreamEmptyStateProps) {
  const styles = useStyles((theme) => ({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
    content: { width: '100%', maxWidth: 300, alignItems: 'center', gap: 10, paddingHorizontal: 24 },
    title: { fontSize: 18, color: theme.colors.foreground, fontWeight: '600', textAlign: 'center' },
    description: { textAlign: 'center', color: theme.colors.mutedForeground },
    plainText: { paddingHorizontal: 16, color: theme.colors.mutedForeground },
  }));

  if (filter !== 'notes') {
    return <Text style={styles.plainText}>{t.stream.emptyState.all}</Text>;
  }

  return (
    <Reanimated.View entering={FadeIn.duration(280)} style={styles.container}>
      <View style={styles.content}>
        <FloatingOmiro />
        <Text style={styles.title}>{t.stream.emptyState.notes.title}</Text>
        <Text style={styles.description}>{t.stream.emptyState.notes.description}</Text>
      </View>
    </Reanimated.View>
  );
}
