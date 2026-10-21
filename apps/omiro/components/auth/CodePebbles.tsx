import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useShakeAnimation } from '~/services/motion/use-shake-animation';

export const CODE_LENGTH = 6;
const GAP = 6;
const DEAL_DELAY_MS = 160;
const DEAL_STAGGER_MS = 45;
const SUCCESS_STAGGER_MS = 60;
const WAVE_STAGGER_MS = 70;

export type CodeStatus = 'idle' | 'checking' | 'success' | 'error';

interface PebbleProps {
  index: number;
  digit: string;
  isActive: boolean;
  status: CodeStatus;
}

function Caret({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 450, easing: Easing.linear }),
          withTiming(1, { duration: 450, easing: Easing.linear }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: 2, height: 22, borderRadius: 1, backgroundColor: color }, style]}
    />
  );
}

// One ink pebble. On mount it is dealt out from where the send circle was (the end of the row),
// travelling `index`-dependent distance so the six fan out together. Reduced motion just fades it in.
function Pebble({ index, digit, isActive, status }: PebbleProps) {
  const { colors } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const [size, setSize] = useState(0);
  const deal = useSharedValue(0);
  const good = useSharedValue(0);
  const wave = useSharedValue(0);
  const pop = useSharedValue(1);
  const wasFilled = useRef(false);
  const styles = useStyles((theme) => ({
    pebble: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    digit: {
      fontFamily: fontFamilies.sans,
      fontSize: 21,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  }));

  const fanDistance = (CODE_LENGTH - 1 - index) * (size + GAP);

  useEffect(() => {
    deal.set(
      withDelay(
        reducedMotion ? 0 : DEAL_DELAY_MS + (CODE_LENGTH - 1 - index) * DEAL_STAGGER_MS,
        reducedMotion
          ? withTiming(1, { duration: 200 })
          : withSpring(1, { damping: 13, stiffness: 150 }),
      ),
    );
  }, [deal, index, reducedMotion]);

  useEffect(() => {
    good.set(
      status === 'success'
        ? withDelay(index * SUCCESS_STAGGER_MS, withTiming(1, { duration: 260 }))
        : 0,
    );
  }, [good, index, status]);

  useEffect(() => {
    cancelAnimation(wave);
    if (status !== 'checking' || reducedMotion) {
      wave.set(0);
      return;
    }
    wave.set(
      withDelay(
        index * WAVE_STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(-7, { duration: 350, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 350, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
        ),
      ),
    );
    return () => cancelAnimation(wave);
  }, [index, reducedMotion, status, wave]);

  const isFilled = digit !== '';
  useEffect(() => {
    if (isFilled && !wasFilled.current && !reducedMotion) {
      pop.set(
        withSequence(
          withTiming(1.14, { duration: 70, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
        ),
      );
    }
    wasFilled.current = isFilled;
  }, [isFilled, pop, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => {
    const dealt = deal.value;
    return {
      opacity: reducedMotion ? dealt : interpolate(dealt, [0, 0.4], [0, 1], 'clamp'),
      backgroundColor: interpolateColor(good.value, [0, 1], [colors.bar, colors.lime]),
      transform: [
        { translateX: reducedMotion ? 0 : (1 - dealt) * fanDistance },
        { translateY: wave.value },
        { scale: (reducedMotion ? 1 : 0.4 + 0.6 * dealt) * pop.value },
      ],
    };
  });

  const ringColor = status === 'error' ? colors.destructive : colors.lime;
  const ringStyle =
    isActive || status === 'error'
      ? { boxShadow: `0 0 0 2px ${colors.background}, 0 0 0 4px ${ringColor}` }
      : null;

  return (
    <Animated.View
      onLayout={(event) => setSize(event.nativeEvent.layout.width)}
      style={[styles.pebble, ringStyle, animatedStyle]}
    >
      {status === 'success' ? (
        <Animated.Text style={[styles.digit, { color: colors.limeForeground }]}>✓</Animated.Text>
      ) : isFilled ? (
        <Animated.Text style={[styles.digit, { color: colors.barForeground }]}>
          {digit}
        </Animated.Text>
      ) : isActive ? (
        <Caret color={colors.lime} />
      ) : (
        <View style={styles.dot} />
      )}
    </Animated.View>
  );
}

interface CodePebblesProps {
  value: string;
  onChangeText: (value: string) => void;
  status: CodeStatus;
  editable: boolean;
  accessibilityLabel: string;
}

// The one-time code as six ink pebbles over a real (transparent) text input, so iOS can still
// autofill the code from the email and the keyboard and focus behave like any other field.
export function CodePebbles({
  value,
  onChangeText,
  status,
  editable,
  accessibilityLabel,
}: CodePebblesProps) {
  const [focused, setFocused] = useState(false);
  const shakeStyle = useShakeAnimation(status === 'error');
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <Animated.View style={shakeStyle}>
      <View style={{ flexDirection: 'row', direction: 'ltr', gap: GAP }}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <Pebble
            key={index.toString()}
            digit={value[index] ?? ''}
            index={index}
            isActive={focused && status !== 'success' && index === activeIndex}
            status={status}
          />
        ))}
        <TextInput
          testID="auth-otp-input-container"
          accessibilityLabel={accessibilityLabel}
          autoComplete="one-time-code"
          autoCorrect={false}
          autoFocus
          caretHidden
          editable={editable}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          selectionColor="transparent"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            color: 'transparent',
          }}
          textContentType="oneTimeCode"
          value={value}
        />
      </View>
    </Animated.View>
  );
}
