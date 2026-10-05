import type { SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

import type { ComposerEntryKind } from './composer.types';

const SEGMENT_SIZE = 34;
const TRACK_PADDING = 2;
// Matches the app's motion guidelines for on-screen movement (--ease-in-out).
const MOVE_EASING = Easing.bezier(0.77, 0, 0.175, 1);

interface ComposerKindToggleProps {
  selected: ComposerEntryKind;
  onSelect: (kind: ComposerEntryKind) => void;
}

const options: { kind: ComposerEntryKind; label: string; icon: SFSymbol; iconFilled: SFSymbol }[] =
  [
    {
      kind: 'chat',
      label: 'Conversation',
      icon: 'bubble.left.and.bubble.right',
      iconFilled: 'bubble.left.and.bubble.right.fill',
    },
    { kind: 'note', label: 'Document', icon: 'doc.text', iconFilled: 'doc.text.fill' },
  ];

// One mutually-exclusive control, not two separate buttons, so the chat/note
// choice reads as a single state with two positions -- like an iOS segmented
// control. The thumb sliding between them is what makes the switch legible.
export function ComposerKindToggle({ selected, onSelect }: ComposerKindToggleProps) {
  const theme = useAppTheme();
  const { inkForeground, primary, primaryForeground } = theme.colors;
  const styles = useStyles(() => ({
    control: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: withAlpha(inkForeground, 0.16),
      borderRadius: 999,
      borderCurve: 'continuous',
      padding: TRACK_PADDING,
    },
  }));
  const reducedMotion = useReducedMotion();
  const selectedIndex = options.findIndex((option) => option.kind === selected);
  const progress = useSharedValue(selectedIndex);

  useEffect(() => {
    progress.set(
      reducedMotion
        ? selectedIndex
        : withTiming(selectedIndex, { duration: 200, easing: MOVE_EASING }),
    );
  }, [selectedIndex, reducedMotion, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * SEGMENT_SIZE }],
  }));

  return (
    <View style={styles.control} testID="composer-kind-control">
      <Animated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: primary,
            borderCurve: 'continuous',
            borderRadius: 999,
            height: SEGMENT_SIZE,
            left: TRACK_PADDING,
            position: 'absolute',
            top: TRACK_PADDING,
            width: SEGMENT_SIZE,
          },
          thumbStyle,
        ]}
      />
      {options.map((option) => {
        const isSelected = option.kind === selected;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={option.kind}
            onPress={() => onSelect(option.kind)}
            style={{
              alignItems: 'center',
              height: SEGMENT_SIZE,
              justifyContent: 'center',
              width: SEGMENT_SIZE,
            }}
            testID={`composer-kind-${option.kind}`}
          >
            <AppIcon
              name={isSelected ? option.iconFilled : option.icon}
              size={16}
              tintColor={isSelected ? primaryForeground : withAlpha(inkForeground, 0.75)}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
