import type { ArtifactType } from '@hominem/rpc/types';
import { Modal, ScrollView, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, makeStyles } from '~/components/theme';
import {
  durations,
  fontFamiliesNative,
  fontSizes,
  radii,
  spacing,
} from '~/components/theme/tokens';

import { Button } from '../ui/Button';

const TYPE_LABEL: Record<ArtifactType, string> = {
  note: 'NOTE',
  task: 'TASK',
  task_list: 'TASK LIST',
  tracker: 'TRACKER',
};

const SAVE_LABEL: Record<ArtifactType, string> = {
  note: 'SAVE NOTE',
  task: 'SAVE TASK',
  task_list: 'SAVE TASK LIST',
  tracker: 'SAVE REVIEW',
};

interface ClassificationReviewProps {
  proposedType: ArtifactType;
  proposedTitle: string;
  proposedChanges: string[];
  previewContent: string;
  onAccept: () => void;
  onReject: () => void;
}

export function ClassificationReview({
  proposedType,
  proposedTitle,
  proposedChanges,
  previewContent,
  onAccept,
  onReject,
}: ClassificationReviewProps) {
  const styles = useClassificationStyles();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useAnimatedReaction(
    () => opacity.value,
    (_current: number, prev: number | null) => {
      'worklet';
      if (prev === null) {
        translateY.value = withTiming(0, { duration: durations.enter });
        opacity.value = withTiming(1, { duration: durations.enter });
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, animatedStyle]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text color="text-secondary" style={styles.typeLabel}>
              SAVE AS {TYPE_LABEL[proposedType]}
            </Text>
            <Text style={styles.title}>{proposedTitle}</Text>
          </View>

          {proposedChanges.length > 0 ? (
            <View style={styles.changesList}>
              {proposedChanges.map((change, index) => (
                <View key={`${change}-${index}`} style={styles.changeRow}>
                  <Text color="text-secondary" style={styles.dash}>
                    -
                  </Text>
                  <Text color="text-secondary" style={styles.changeText}>
                    {change}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <ScrollView nestedScrollEnabled style={styles.preview}>
            <Text color="text-secondary" style={styles.previewText}>
              {previewContent}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              accessibilityLabel={SAVE_LABEL[proposedType]}
              onPress={onAccept}
              style={[styles.button, styles.primaryButton]}
              variant="primary"
            >
              {SAVE_LABEL[proposedType]}
            </Button>
            <Button
              accessibilityLabel="Discard"
              onPress={onReject}
              style={[styles.button, styles.secondaryButton]}
              variant="outline"
            >
              DISCARD
            </Button>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useClassificationStyles = makeStyles((theme) => ({
  actions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  button: {
    flex: 1,
  },
  changeRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[2],
  },
  changesList: {
    gap: spacing[1],
  },
  changeText: {
    flex: 1,
  },
  dash: {
    marginTop: 1,
    opacity: 0.4,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: theme.colors['border-default'],
    borderRadius: radii.sm,
    height: 4,
    marginBottom: spacing[1],
    width: 36,
  },
  header: {
    gap: spacing[1],
  },
  overlay: {
    backgroundColor: theme.colors['overlay-modal-high'],
    flex: 1,
    justifyContent: 'flex-end',
  },
  preview: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    maxHeight: 120,
    padding: spacing[3],
  },
  previewText: {
    fontFamily: fontFamiliesNative.mono,
  },
  primaryButton: {
    backgroundColor: theme.colors.foreground,
    borderColor: theme.colors.foreground,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: theme.colors['border-default'],
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors['border-default'],
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderTopWidth: 1,
    gap: spacing[4],
    padding: spacing[5],
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  typeLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
}));
