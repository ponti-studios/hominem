import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme, withAlpha } from '~/components/theme';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const SHEET_SPRING = { damping: 22, mass: 0.7, stiffness: 240 };

interface BottomSheetProps {
  children: ReactNode;
  // Distance from the top of the screen to the sheet's top edge. Omit for a
  // sheet that hugs its content.
  maxHeight?: number | `${number}%`;
  onClose: () => void;
  testID?: string;
  visible: boolean;
}

// The system's modal surface: a rounded-top sheet over a dimmed scrim. All
// motion (slide, scrim fade, drag-to-dismiss) runs on the UI thread through
// Reanimated; React only re-renders on open/close.
export function BottomSheet({
  children,
  maxHeight = '85%',
  onClose,
  testID,
  visible,
}: BottomSheetProps) {
  const theme = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      translateY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      }
      translateY.set(withSpring(0, SHEET_SPRING));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          style={[
            styles.scrim, // Alpha in the color, not `opacity`: the FadeIn entering animation owns opacity.
            { backgroundColor: withAlpha(theme.colors.overlayScrim, 0.4) },
          ]}
        >
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          entering={reducedMotion ? FadeIn.duration(160) : SlideInDown.springify().damping(22)}
          exiting={reducedMotion ? FadeOut.duration(140) : SlideOutDown.duration(180)}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              boxShadow: theme.shadows.float,
              maxHeight,
              paddingBottom: bottom + 16,
            },
            sheetStyle,
          ]}
          testID={testID}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.grabberArea}>
              <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { borderCurve: 'continuous', overflow: 'hidden', paddingHorizontal: 20 },
  grabberArea: { alignItems: 'center', height: 28, justifyContent: 'center' },
  grabber: { borderRadius: 3, height: 5, width: 40 },
});
