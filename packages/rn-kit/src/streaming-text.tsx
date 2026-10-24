import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { advance, initialState, settleOld } from './streaming-text-state';
import { useReducedMotion } from './use-reduced-motion';

export interface StreamingTextProps {
  content: string;
  style?: StyleProp<TextStyle>;
  /** Highlighter colour new chunks land in (and the caret). Default lime. */
  inkColor?: string;
  /** How long a chunk takes to dry to plain text, in ms. Default 1100. */
  dryMs?: number;
  /** Extra time after drying before a chunk folds into the plain run, in ms. Default 150. */
  settleGraceMs?: number;
  /** How often to check for chunks ready to fold, in ms. Default 400. */
  settleTickMs?: number;
  /** Show the pulsing caret at the tip. Default true. */
  caret?: boolean;
  /** One half-pulse of the caret, in ms. Default 520. */
  caretPulseMs?: number;
  /** Force reduced motion on or off; follows the system setting when omitted. */
  reducedMotion?: boolean;
}

// Highlighter-ink streaming: every chunk that arrives lands soaked in `inkColor`,
// then dries to plain text. Chunks that have finished drying are folded back into
// one plain run, so a 3,000-word essay never carries more than a handful of
// animated spans.

function InkChunk({ color, dryMs, text }: { color: string; dryMs: number; text: string }) {
  const dry = useSharedValue(0);

  useEffect(() => {
    dry.set(withTiming(1, { duration: dryMs }));
  }, [dry, dryMs]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(dry.value, [0, 1], [color, `${color}00`]),
  }));

  return <Animated.Text style={style}>{text}</Animated.Text>;
}

function InkCaret({ color, pulseMs }: { color: string; pulseMs: number }) {
  const glow = useSharedValue(1);

  useEffect(() => {
    glow.set(
      withRepeat(
        withSequence(withTiming(0.25, { duration: pulseMs }), withTiming(1, { duration: pulseMs })),
        -1,
      ),
    );
  }, [glow, pulseMs]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(glow.value, [0, 1], [`${color}00`, color]),
  }));

  return <Animated.Text style={style}>{'  '}</Animated.Text>;
}

export function StreamingText({
  content,
  style,
  inkColor = '#C6F432',
  dryMs = 1100,
  settleGraceMs = 150,
  settleTickMs = 400,
  caret = true,
  caretPulseMs = 520,
  reducedMotion,
}: StreamingTextProps) {
  const systemReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? systemReducedMotion;
  const [state, setState] = useState(() => initialState(content));

  const next = advance(state, content, Date.now());
  if (next !== state) {
    setState(next);
  }

  const hasLive = state.chunks.length > 0;
  useEffect(() => {
    if (!hasLive) {
      return;
    }
    const timer = setInterval(
      () => setState((s) => settleOld(s, Date.now(), dryMs + settleGraceMs)),
      settleTickMs,
    );
    return () => clearInterval(timer);
  }, [hasLive, dryMs, settleGraceMs, settleTickMs]);

  if (isReducedMotion) {
    return <Text style={style}>{content}</Text>;
  }

  return (
    <Text style={style}>
      {next.settled}
      {next.chunks.map((chunk) => (
        <InkChunk key={chunk.id} color={inkColor} dryMs={dryMs} text={chunk.text} />
      ))}
      {caret ? <InkCaret color={inkColor} pulseMs={caretPulseMs} /> : null}
    </Text>
  );
}
