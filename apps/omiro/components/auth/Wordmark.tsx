import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

import { WORDMARK_HEIGHT } from './brand-layout';

const WORD = 'omiro';
const FIRST_LETTER_DELAY_MS = 250;
const LETTER_STAGGER_MS = 40;
const LETTER_RISE = 10;

function Letter({ char, index, animate }: { char: string; index: number; animate: boolean }) {
  const reducedMotion = useReducedMotion();
  const styles = useStyles((theme) => ({
    letter: {
      ...theme.textVariants.title2,
      color: theme.colors.foreground,
      fontSize: 26,
      fontWeight: '600',
      letterSpacing: -0.5,
      lineHeight: WORDMARK_HEIGHT,
    },
  }));
  const progress = useSharedValue(animate && !reducedMotion ? 0 : 1);

  useEffect(() => {
    if (!animate || reducedMotion) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(
        FIRST_LETTER_DELAY_MS + index * LETTER_STAGGER_MS,
        withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [animate, index, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * LETTER_RISE }],
  }));

  return <Animated.Text style={[styles.letter, animatedStyle]}>{char}</Animated.Text>;
}

// The "omiro" wordmark. With `animate` the letters rise in one after another; without it they are
// simply there.
export function Wordmark({ animate = false, testID }: { animate?: boolean; testID?: string }) {
  return (
    <Animated.View
      accessibilityLabel={WORD}
      accessibilityRole="header"
      style={{ flexDirection: 'row', direction: 'ltr', height: WORDMARK_HEIGHT }}
      testID={testID}
    >
      {WORD.split('').map((char, index) => (
        <Letter key={`${char}-${index.toString()}`} animate={animate} char={char} index={index} />
      ))}
    </Animated.View>
  );
}
