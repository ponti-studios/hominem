import type { ArtifactType } from '@hominem/rpc/types';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamilies, useStyles } from '~/components/theme';
import { Button } from '~/components/ui/button';
import { ModalOverlay } from '~/components/ui/modal-overlay';
import t from '~/translations';

interface ClassificationReviewProps {
  proposedType: ArtifactType;
  proposedTitle: string;
  proposedChanges: string[];
  previewContent: string;
  items?: { title: string; description?: string }[];
  onAccept: () => void;
  onReject: () => void;
}

export function ClassificationReview({
  proposedType,
  proposedTitle,
  proposedChanges,
  previewContent,
  items,
  onAccept,
  onReject,
}: ClassificationReviewProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles((theme) => ({
    container: {
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: theme.borderRadii['2xl'],
      borderTopRightRadius: theme.borderRadii['2xl'],
      gap: 20,
      paddingHorizontal: 24,
      paddingTop: 16,
    },
    handleBar: {
      alignSelf: 'center',
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      height: 4,
      marginBottom: 8,
      width: 36,
    },
    header: { gap: 8 },
    typeLabel: {
      ...theme.textVariants.caption1,
      color: theme.colors.mutedForeground,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: { color: theme.colors.foreground, fontSize: 24, fontWeight: '800' },
    changesList: { gap: 8 },
    changeItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    changeBullet: { color: theme.colors.primary, fontWeight: '800', marginTop: 1 },
    changeText: { color: theme.colors.mutedForeground, flex: 1 },
    previewScrollArea: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadii.xl,
      maxHeight: 120,
      padding: 16,
    },
    previewText: { color: theme.colors.mutedForeground, fontFamily: fontFamilies.mono },
    actions: { flexDirection: 'row', gap: 12 },
    acceptAction: { flex: 1 },
    rejectAction: { flex: 1 },
  }));
  const isEmptyExtraction = items !== undefined && items.length === 0;
  const acceptLabel =
    items !== undefined
      ? t.chat.actions.createTasksLabel(items.length)
      : t.chat.classification.saveLabel[proposedType];

  return (
    <ModalOverlay
      visible
      onClose={onReject}
      dismissOnBackdropPress={false}
      backdropToken="overlay-scrim"
      position="bottom"
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeInUp.duration(150)}
        style={[{ paddingBottom: insets.bottom + 16 }, styles.container]}
      >
        <View style={styles.handleBar} />
        <View style={styles.header}>
          <Text style={styles.typeLabel}>
            {t.chat.classification.saveAsPrefix} {t.chat.classification.typeLabel[proposedType]}
          </Text>
          <Text style={styles.title}>{proposedTitle}</Text>
        </View>

        {proposedChanges.length > 0 ? (
          <View style={styles.changesList}>
            {proposedChanges.map((change) => (
              <View key={change} style={styles.changeItem}>
                <Text style={styles.changeBullet}>•</Text>
                <Text style={styles.changeText}>{change}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {items === undefined ? (
          <ScrollView nestedScrollEnabled style={styles.previewScrollArea}>
            <Text style={styles.previewText}>{previewContent}</Text>
          </ScrollView>
        ) : null}

        <View style={styles.actions}>
          {isEmptyExtraction ? null : (
            <View style={styles.acceptAction}>
              <Button
                testID="classification-review-accept"
                label={acceptLabel}
                onPress={onAccept}
                variant="primary"
              />
            </View>
          )}
          <View style={styles.rejectAction}>
            <Button
              testID="classification-review-reject"
              label={t.chat.classification.discard}
              onPress={onReject}
              variant="secondary"
            />
          </View>
        </View>
      </Animated.View>
    </ModalOverlay>
  );
}
