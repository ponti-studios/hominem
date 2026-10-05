import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppTheme } from '~/components/theme';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;
const SHEET_SPRING = { damping: 24, mass: 0.7, stiffness: 260 };
const CLOSE_MS = 180;
const SCRIM_OPACITY = 0.4;

interface BottomSheetProps {
  children: ReactNode;
  // Cap on the sheet's height; defaults to 85% of the screen.
  maxHeight?: number;
  onClose: () => void;
  testID?: string;
  visible: boolean;
}

// The system's modal surface: a rounded-top sheet over a dimmed scrim, lifted
// above the keyboard. Open, close and drag-to-dismiss are Reanimated shared
// values (UI thread); React re-renders only when `visible` flips. The Modal
// stays mounted until the close animation finishes.
export function BottomSheet({ children, maxHeight, onClose, testID, visible }: BottomSheetProps) {
  const theme = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  // Mount on open during render; unmounting waits for the close animation.
  if (visible && !mounted) {
    setMounted(true);
  }
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(windowHeight);

  useEffect(() => {
    if (visible) {
      dragY.set(0);
      progress.set(
        reducedMotion ? withTiming(1, { duration: CLOSE_MS }) : withSpring(1, SHEET_SPRING),
      );
      return;
    }
    progress.set(
      withTiming(0, { duration: CLOSE_MS }, (finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setMounted, false);
        }
      }),
    );
  }, [dragY, progress, reducedMotion, visible]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      dragY.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
        return;
      }
      dragY.set(withSpring(0, SHEET_SPRING));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value + dragY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.min(progress.value, 1) * SCRIM_OPACITY,
  }));

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: theme.colors.overlayScrim }, scrimStyle]}
        >
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none" style={styles.avoiding}>
          <Animated.View
            onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.card,
                boxShadow: theme.shadows.float,
                maxHeight: maxHeight ?? windowHeight * 0.85,
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
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avoiding: { flex: 1, justifyContent: 'flex-end' },
  scrim: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: {
    borderCurve: 'continuous',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },
  grabberArea: { alignItems: 'center', height: 28, justifyContent: 'center' },
  grabber: { borderRadius: 3, height: 5, width: 40 },
});
