import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

// Highlighter-ink streaming: every chunk that arrives lands soaked in lime, then
// dries to plain text. A block caret in the same lime pulses at the tip of the
// reply. Chunks that have finished drying are folded back into one plain run, so
// a 3,000-word essay never carries more than a handful of animated spans.
const DRY_MS = 1100;
const SETTLE_AFTER_MS = DRY_MS + 150;
const SETTLE_TICK_MS = 400;

type Chunk = { id: number; text: string; bornAt: number };
type State = { settled: string; chunks: Chunk[]; seen: string; nextId: number };

function initialState(content: string): State {
  return { settled: content, chunks: [], seen: content, nextId: 0 };
}

function advance(state: State, content: string): State {
  if (content === state.seen) {
    return state;
  }
  // The text was replaced rather than extended (regenerate, edit): start over.
  if (!content.startsWith(state.seen)) {
    return initialState(content);
  }
  return {
    ...state,
    chunks: [
      ...state.chunks,
      { id: state.nextId, text: content.slice(state.seen.length), bornAt: Date.now() },
    ],
    nextId: state.nextId + 1,
    seen: content,
  };
}

function settleOld(state: State): State {
  const cutoff = Date.now() - SETTLE_AFTER_MS;
  let settled = state.settled;
  let index = 0;
  while (index < state.chunks.length && state.chunks[index]!.bornAt <= cutoff) {
    settled += state.chunks[index]!.text;
    index += 1;
  }
  return index === 0 ? state : { ...state, settled, chunks: state.chunks.slice(index) };
}

function InkChunk({ color, text }: { color: string; text: string }) {
  const dry = useSharedValue(0);

  useEffect(() => {
    dry.set(withTiming(1, { duration: DRY_MS }));
  }, [dry]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(dry.value, [0, 1], [color, `${color}00`]),
  }));

  return <Animated.Text style={style}>{text}</Animated.Text>;
}

function InkCaret({ color }: { color: string }) {
  const glow = useSharedValue(1);

  useEffect(() => {
    glow.set(
      withRepeat(
        withSequence(withTiming(0.25, { duration: 520 }), withTiming(1, { duration: 520 })),
        -1,
      ),
    );
  }, [glow]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(glow.value, [0, 1], [`${color}00`, color]),
  }));

  return <Animated.Text style={style}>{'  '}</Animated.Text>;
}

export function StreamingText({ content, style }: { content: string; style: object }) {
  const { lime } = useAppTheme().colors;
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState(() => initialState(content));

  const next = advance(state, content);
  if (next !== state) {
    setState(next);
  }

  const hasLive = state.chunks.length > 0;
  useEffect(() => {
    if (!hasLive) {
      return;
    }
    const timer = setInterval(() => setState(settleOld), SETTLE_TICK_MS);
    return () => clearInterval(timer);
  }, [hasLive]);

  if (reducedMotion) {
    return <Text style={style}>{content}</Text>;
  }

  return (
    <Text style={style}>
      {next.settled}
      {next.chunks.map((chunk) => (
        <InkChunk key={chunk.id} color={lime} text={chunk.text} />
      ))}
      <InkCaret color={lime} />
    </Text>
  );
}
