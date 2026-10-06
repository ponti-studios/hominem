import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useDerivedValue } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useShimmerProgress } from '~/hooks/use-shimmer-progress';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import t from '~/translations';

import { ShimmerText } from './chat-thinking-indicator';

const BAR_HEIGHT = 56;
const STRIPE_WIDTH = 14;
const STRIPE_PERIOD = 28;
// Horizontal run of each stripe over the bar's height: the slant.
const STRIPE_SLANT = 26;

interface ChatGenerationBarProps {
  generation: ChatGenerationState;
  onCancel: () => void;
  onRetry?: () => void;
  // Puts the failed message back in the composer. Hidden when there is no
  // message to restore.
  onEdit?: () => void;
}

// The composer, flattened to one line while a reply is generating: lime and
// striped while working, ink while stopping, coral-ringed when it failed. It
// never changes height, so the conversation above does not jump between
// states.
export function ChatGenerationBar({
  generation,
  onCancel,
  onEdit,
  onRetry,
}: ChatGenerationBarProps) {
  const isFailed = generation.stage === 'failed';
  const isStopping = generation.stage === 'stopping' || generation.stage === 'cancelled';
  return (
    <Animated.View entering={FadeIn.duration(160)} testID="chat-generation-bar">
      {isFailed ? (
        <FailedBar onEdit={onEdit} onRetry={onRetry} />
      ) : isStopping ? (
        <StoppingBar />
      ) : (
        <WorkingBar onCancel={onCancel} />
      )}
    </Animated.View>
  );
}

function useBarStyles() {
  return useStyles((theme) => ({
    bar: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: BAR_HEIGHT / 2,
      boxShadow: theme.shadows.float,
      flexDirection: 'row',
      gap: 12,
      height: BAR_HEIGHT,
      overflow: 'hidden',
      paddingLeft: 22,
      paddingRight: 6,
    },
    working: { backgroundColor: theme.colors.lime },
    stopping: { backgroundColor: theme.colors.bar, boxShadow: theme.shadows.bar },
    failed: {
      backgroundColor: theme.colors.bar,
      boxShadow: theme.shadows.bar,
      borderColor: theme.colors.coral,
      borderWidth: 2,
      paddingLeft: 6,
    },
    workingLabel: {
      color: theme.colors.limeForeground,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    stoppingLabel: { color: theme.colors.barForeground, fontSize: 18, fontWeight: '800' },
    grow: { flex: 1 },
    stopButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.ink,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    disabledButton: {
      backgroundColor: 'rgba(127, 127, 160, 0.3)',
      borderRadius: 22,
      height: 44,
      width: 44,
    },
    failedBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.coral,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    failedBody: { flex: 1, minWidth: 0 },
    failedTitle: { color: theme.colors.barForeground, fontSize: 16, fontWeight: '800' },
    failedDetail: {
      color: theme.colors.barForeground,
      fontSize: 12,
      fontWeight: '600',
      opacity: 0.65,
    },
    retryButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    editButton: {
      alignItems: 'center',
      backgroundColor: 'rgba(127, 127, 160, 0.3)',
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
  }));
}

function WorkingBar({ onCancel }: { onCancel: () => void }) {
  const styles = useBarStyles();
  const { lime } = useAppTheme().colors;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, styles.working]}
      testID="chat-activity"
    >
      <Stripes />
      <View style={styles.grow}>
        <ShimmerText
          fade={lime}
          label={t.chat.generation.thinkingBar}
          style={styles.workingLabel}
        />
      </View>
      <Pressable
        accessibilityLabel={t.chat.generation.stopA11y}
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.stopButton}
        testID="chat-generation-stop"
      >
        <AppIcon name="stop.fill" size={18} tintColor={lime} />
      </Pressable>
    </View>
  );
}

function StoppingBar() {
  const styles = useBarStyles();
  const { bar } = useAppTheme().colors;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, styles.stopping]}
      testID="chat-activity"
    >
      <View style={styles.grow}>
        <ShimmerText
          fade={bar}
          label={t.chat.generation.stoppingBar}
          style={styles.stoppingLabel}
        />
      </View>
      <View style={styles.disabledButton} />
    </View>
  );
}

function FailedBar({ onEdit, onRetry }: { onEdit?: () => void; onRetry?: () => void }) {
  const styles = useBarStyles();
  const { barForeground, limeForeground } = useAppTheme().colors;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.bar, styles.failed]}
      testID="chat-activity"
    >
      <View style={styles.failedBadge}>
        <AppIcon name="exclamationmark" size={20} tintColor={limeForeground} />
      </View>
      <View style={styles.failedBody}>
        <Text numberOfLines={1} style={styles.failedTitle}>
          {t.chat.generation.failed}
        </Text>
        <Text numberOfLines={1} style={styles.failedDetail}>
          {t.chat.generation.failedBarDetail}
        </Text>
      </View>
      {onRetry ? (
        <Pressable
          accessibilityLabel={t.chat.generation.retryA11y}
          accessibilityRole="button"
          onPress={onRetry}
          style={styles.retryButton}
          testID="chat-generation-retry"
        >
          <AppIcon name="arrow.clockwise" size={20} tintColor={limeForeground} />
        </Pressable>
      ) : null}
      {onEdit ? (
        <Pressable
          accessibilityLabel={t.chat.generation.editA11y}
          accessibilityRole="button"
          onPress={onEdit}
          style={styles.editButton}
          testID="chat-generation-edit"
        >
          <AppIcon name="square.and.pencil" size={20} tintColor={barForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Diagonal ink stripes sliding right: "working", at a glance. They hold still
// under Reduce Motion.
function Stripes() {
  const reducedMotion = useReducedMotion();
  const progress = useShimmerProgress(reducedMotion);
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const paths = useMemo(() => {
    const count = Math.ceil((width + STRIPE_SLANT) / STRIPE_PERIOD) + 2;
    return Array.from({ length: count }, (_, index) => {
      const x = index * STRIPE_PERIOD - STRIPE_PERIOD;
      const path = Skia.Path.Make();
      path.moveTo(x + STRIPE_SLANT, 0);
      path.lineTo(x + STRIPE_SLANT + STRIPE_WIDTH, 0);
      path.lineTo(x + STRIPE_WIDTH, BAR_HEIGHT);
      path.lineTo(x, BAR_HEIGHT);
      path.close();
      return path;
    });
  }, [width]);
  const transform = useDerivedValue(
    () => [{ translateX: progress.value * STRIPE_PERIOD }],
    [progress],
  );
  return (
    <View
      onLayout={onLayout}
      pointerEvents="none"
      style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
    >
      {width > 0 ? (
        <Canvas style={{ height: BAR_HEIGHT, width }}>
          <Group transform={transform}>
            {paths.map((path, index) => (
              <Path color="rgba(20, 18, 31, 0.07)" key={index} path={path} />
            ))}
          </Group>
        </Canvas>
      ) : null}
    </View>
  );
}
