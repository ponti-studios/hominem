import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  useComposerAttachments,
  type ComposerAttachment,
} from '~/components/composer/ComposerContext';
import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { ShimmerProgressBar } from '~/components/ui/shimmer-progress-bar';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';
import t from '~/translations';

const BADGE_SIZE = 16;

function useComposerAttachmentStyles() {
  return useStyles((theme) => ({
    attachmentContainer: {
      width: 48,
      height: 48,
      overflow: 'hidden',
      backgroundColor: theme.colors.card,
    },
    attachmentImage: { width: 48, height: 48 },
    removeBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 16,
      height: 16,
      backgroundColor: theme.colors.overlayScrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.colors.overlayScrim,
    },
    progressBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    errorText: { ...theme.textVariants.caption1, color: theme.colors.destructive },
  }));
}

function AttachmentItem({
  attachment,
  onRemove,
  overlayScrim,
  primary,
  primaryForeground,
  progress,
}: {
  attachment: ComposerAttachment;
  onRemove: (id: string) => void;
  overlayScrim: string;
  primary: string;
  primaryForeground: string;
  progress: number;
}) {
  const uploading = progress > 0 && progress < 100;
  const styles = useComposerAttachmentStyles();
  return (
    <Pressable
      style={styles.attachmentContainer}
      onPress={() => onRemove(attachment.id)}
      accessibilityLabel={t.notes.editor.removeFile(attachment.name)}
      accessibilityRole="button"
    >
      {attachment.localUri && (
        <Image
          source={{ uri: attachment.localUri }}
          style={styles.attachmentImage}
          contentFit="cover"
        />
      )}
      <View style={styles.removeBadge} pointerEvents="none">
        <AppIcon name="xmark" size={BADGE_SIZE} tintColor={primaryForeground} />
      </View>
      {uploading && (
        <>
          <View style={styles.uploadOverlay} />
          <ShimmerProgressBar
            borderRadius={0}
            fillColor={primary}
            height={4}
            progress={progress / 100}
            style={styles.progressBarContainer}
            trackColor={overlayScrim}
          />
        </>
      )}
    </Pressable>
  );
}

export function ComposerAttachmentRow() {
  const { attachments, errors, isUploading, progressByAssetId, onRemove } =
    useComposerAttachments();
  const { overlayScrim, primary, primaryForeground } = useAppTheme().colors;
  const styles = useComposerAttachmentStyles();
  const prefersReducedMotion = useReducedMotion();
  const renderAttachment = useCallback(
    ({ item }: { item: ComposerAttachment }) => (
      <AttachmentItem
        attachment={item}
        onRemove={onRemove}
        overlayScrim={overlayScrim}
        primary={primary}
        primaryForeground={primaryForeground}
        progress={progressByAssetId[item.id] ?? 0}
      />
    ),
    [onRemove, overlayScrim, primary, primaryForeground, progressByAssetId],
  );

  if (attachments.length === 0 && errors.length === 0 && !isUploading) {
    return null;
  }

  return (
    // Split for the same reason as chat-message.tsx / chat-message-actions.tsx:
    // entering/exiting on the outer view, layout (the strip growing/shrinking
    // as attachments are added/removed) on the inner one.
    <Animated.View
      entering={nativeMotionAnimations.fadeInQuick}
      exiting={nativeMotionAnimations.fadeOutQuick}
    >
      <Animated.View layout={prefersReducedMotion ? undefined : nativeMotionAnimations.layoutQuick}>
        {attachments.length > 0 && (
          <FlashList
            data={attachments}
            horizontal
            keyExtractor={(attachment) => attachment.id}
            showsHorizontalScrollIndicator={false}
            renderItem={renderAttachment}
          />
        )}
        {errors.length > 0 && (
          <Animated.Text style={styles.errorText}>{errors.join(' · ')}</Animated.Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}
