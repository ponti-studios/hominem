import { ShimmerText as KitShimmerText } from '@hominem/rn-kit';
import { View, type TextStyle } from 'react-native';
import Animated, { FadeOut, FadeOutUp } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionContracts } from '~/services/motion/native-motion';
import t from '~/translations';

// Theme adapter over the shared ShimmerText: the sweep erases glyphs to `fade`
// (the surface the label sits on), defaulting to the page background.
export function ShimmerText({
  fade,
  label,
  style,
}: {
  fade?: string;
  label: string;
  style?: TextStyle;
}) {
  const { background } = useAppTheme().colors;
  return <KitShimmerText fadeColor={fade ?? background} label={label} style={style} />;
}

export function ChatThinkingIndicator() {
  const styles = useStyles((theme) => ({
    container: { alignSelf: 'flex-start' },
    row: { paddingTop: 4 },
    label: { color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 },
  }));
  const reducedMotion = useReducedMotion();
  const { card } = useAppTheme().colors;

  return (
    <Animated.View
      exiting={
        reducedMotion
          ? FadeOut.duration(nativeMotionContracts.duration.quick)
          : FadeOutUp.duration(nativeMotionContracts.duration.quick)
      }
      style={styles.container}
      testID="chat-assistant-activity"
    >
      <View style={styles.row}>
        <ShimmerText fade={card} label={t.chat.thinkingIndicator} style={styles.label} />
      </View>
    </Animated.View>
  );
}
