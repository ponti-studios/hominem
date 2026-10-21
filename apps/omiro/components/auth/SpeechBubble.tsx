import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

// What the mascot says. It sits centred under the wordmark and is as wide as its text (up to the form
// width), so a longer translation wraps instead of colliding with the mascot. A new line replaces the
// old one.
export function SpeechBubble({ text }: { text: string | null }) {
  const reducedMotion = useReducedMotion();
  const styles = useStyles((theme) => ({
    bubble: {
      alignSelf: 'center',
      maxWidth: '100%',
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 16,
      backgroundColor: theme.colors.card,
      boxShadow: '0 6px 18px -8px rgba(20, 18, 31, 0.35)',
    },
    tail: {
      position: 'absolute',
      top: -5,
      alignSelf: 'center',
      width: 12,
      height: 12,
      borderRadius: 3,
      backgroundColor: theme.colors.card,
      transform: [{ rotate: '45deg' }],
    },
    text: {
      ...theme.textVariants.subhead,
      color: theme.colors.foreground,
      fontWeight: '500',
      textAlign: 'center',
    },
  }));

  if (!text) {
    return null;
  }

  return (
    <Animated.View
      key={text}
      accessibilityLiveRegion="polite"
      entering={reducedMotion ? FadeIn.duration(150) : ZoomIn.springify().damping(14)}
      exiting={FadeOut.duration(120)}
      style={styles.bubble}
    >
      <View style={styles.tail} />
      <Animated.Text style={styles.text}>{text}</Animated.Text>
    </Animated.View>
  );
}
