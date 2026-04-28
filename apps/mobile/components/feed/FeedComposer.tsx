import { ProgressView, Host as SwiftUIHost } from '@expo/ui/swift-ui';
import { frame, progressViewStyle } from '@expo/ui/swift-ui/modifiers';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useApiClient } from '@hominem/rpc/react';
import { radii, spacing } from '@hominem/ui/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildChatTitle,
  canSubmitComposerDraft,
  getUploadedAttachmentIds,
} from '~/components/composer/composerActions';
import type { ComposerAttachment, ComposerMode } from '~/components/composer/composerState';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { GlassActionButton } from '~/components/feed/GlassActionButton';
import { CameraModal } from '~/components/media/camera-modal';
import { VoiceSessionModal } from '~/components/media/voice-session-modal';
import { makeStyles } from '~/components/theme';
import { createLayoutTransition } from '~/components/theme/animations';
import { useThemeColors } from '~/components/theme/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import type { ChatWithActivity } from '~/services/chat/session-types';
import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { chatKeys } from '~/services/notes/query-keys';
import { useCreateNote } from '~/services/notes/use-create-note';

// ── Layout constants ──────────────────────────────────────────────────────────

const MAX_WIDTH = 500;
const INPUT_MIN_H = spacing[6] + spacing[4]; // 48px
const INPUT_MAX_H = spacing[6] * 9; // 288px
const PILL_RADIUS = 20;
function AttachmentRow({
  attachments,
  errors,
  isUploading,
  progressByAssetId,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  errors: string[];
  isUploading: boolean;
  progressByAssetId: Record<string, number>;
  onRemove: (id: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  if (attachments.length === 0 && errors.length === 0 && !isUploading) return null;

  return (
    <View style={styles.attachmentRow}>
      {attachments.map((a) => {
        const progress = progressByAssetId[a.id] ?? 0;
        const uploading = progress > 0 && progress < 100;
        return (
          <Pressable
            key={a.id}
            style={styles.thumb}
            onPress={() => onRemove(a.id)}
            accessibilityLabel={`Remove ${a.name}`}
            accessibilityRole="button"
          >
            {a.localUri && (
              <Image source={{ uri: a.localUri }} style={styles.thumbImage} contentFit="cover" />
            )}
            <View style={styles.thumbBadge} pointerEvents="none">
              <AppIcon name="xmark" size={spacing[2] * 2} tintColor={themeColors.white} />
            </View>
            {uploading && (
              <>
                <View style={styles.thumbDim} />
                <SwiftUIHost style={styles.progressHost}>
                  <ProgressView
                    value={progress / 100}
                    modifiers={[progressViewStyle('linear'), frame({ height: spacing[1] })]}
                  />
                </SwiftUIHost>
              </>
            )}
          </Pressable>
        );
      })}
      {errors.length > 0 && (
        <Animated.Text style={styles.errorText}>{errors.join(' · ')}</Animated.Text>
      )}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FeedComposerProps {
  onClearanceChange?: (height: number) => void;
  seedMessage?: string;
}

export function FeedComposer({ onClearanceChange, seedMessage }: FeedComposerProps) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const isDark = useColorScheme() === 'dark';
  const blurTint = isDark ? ('dark' as const) : ('light' as const);
  const pillOverlayColor = isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.6)';
  const pillBorderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const prefersReducedMotion = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const animatedH = useSharedValue(INPUT_MIN_H);
  const inputRef = useRef<TextInput>(null);
  const voiceModalRef = useRef<BottomSheetModal>(null);
  const client = useApiClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote } = useCreateNote();

  const [message, setMessage] = useState(seedMessage ?? '');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [, setMode] = useState<ComposerMode>('text');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChatCreating, setIsChatCreating] = useState(false);
  const { handleCameraCapture, handleVoiceTranscript, pickAttachment, uploadState } =
    useComposerMediaActions({
      attachments,
      setAttachments,
      message,
      setMessage,
      setIsRecording,
      setMode,
    });

  const uploadedAttachmentIds = useMemo(() => getUploadedAttachmentIds(attachments), [attachments]);

  const canSubmit = canSubmitComposerDraft({
    isUploading: uploadState.isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes: [],
  });

  const clearDraft = useCallback(() => {
    setMessage('');
    setAttachments([]);
    animatedH.value = INPUT_MIN_H;
  }, [animatedH]);

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    setIsSaving(true);
    try {
      await createNote({
        text: message.trim(),
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      });
      donateAddNoteIntent();
      await invalidateInboxQueries(queryClient);
      requestTopReveal();
      clearDraft();
      Keyboard.dismiss();
    } finally {
      setIsSaving(false);
    }
  }, [
    canSubmit,
    isSaving,
    createNote,
    message,
    uploadedAttachmentIds,
    queryClient,
    requestTopReveal,
    clearDraft,
  ]);

  const handleChat = useCallback(async () => {
    if (!canSubmit || isChatCreating) return;
    setIsChatCreating(true);
    try {
      const chatRes = await client.api.chats.$post({ json: { title: buildChatTitle(message) } });
      const chat = await chatRes.json();
      queryClient.setQueryData<ChatWithActivity[] | undefined>(chatKeys.resumableSessions, (prev) =>
        upsertInboxSessionActivity(
          prev ?? [],
          createChatInboxRefreshSnapshot({
            chatId: chat.id,
            noteId: chat.noteId,
            title: chat.title,
            timestamp: chat.createdAt,
            userId: chat.userId,
          }),
        ),
      );
      void invalidateInboxQueries(queryClient);
      clearDraft();
      router.push(
        `/(protected)/(tabs)/chat/${chat.id}?initialMessage=${encodeURIComponent(message.trim())}` as RelativePathString,
      );
      requestTopReveal();
    } finally {
      setIsChatCreating(false);
    }
  }, [
    canSubmit,
    isChatCreating,
    client,
    message,
    queryClient,
    clearDraft,
    router,
    requestTopReveal,
  ]);

  const handleRemoveAttachment = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (target?.uploadedFile?.id) {
        void client.api.files[':fileId']
          .$delete({ param: { fileId: target.uploadedFile.id } })
          .catch(() => undefined);
      }
    },
    [attachments, client],
  );

  const showPlusMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) setIsCameraOpen(true);
        else if (i === 2) void pickAttachment();
      },
    );
  }, [pickAttachment]);

  const onContentSizeChange = useCallback(
    (h: number) => {
      const clamped = Math.min(Math.max(h, INPUT_MIN_H), INPUT_MAX_H);
      animatedH.value = withSpring(clamped, {
        damping: 20,
        stiffness: 220,
        mass: 0.7,
        overshootClamping: false,
      });
    },
    [animatedH],
  );

  const inputStyle = useAnimatedStyle(() => ({
    minHeight: animatedH.value,
    maxHeight: INPUT_MAX_H,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
  }));

  return (
    <Animated.View style={[styles.container, shellStyle]}>
      <Animated.View
        layout={createLayoutTransition(prefersReducedMotion)}
        onLayout={(e) => {
          onClearanceChange?.(e.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]));
        }}
        style={[styles.surface, { borderColor: pillBorderColor }]}
        testID="feed-composer"
      >
        {/* Surface background is clipped; the outer wrapper can still overflow. */}
        <View style={[StyleSheet.absoluteFill, styles.blurClip]}>
          <BlurView intensity={24} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: pillOverlayColor }]} />
        </View>
        {/* Top-edge highlight for the floating surface. */}
        <View style={styles.specHighlight} pointerEvents="none" />

        <Animated.View layout={createLayoutTransition(prefersReducedMotion)}>
          <AttachmentRow
            attachments={attachments}
            errors={uploadState.errors}
            isUploading={uploadState.isUploading}
            progressByAssetId={uploadState.progressByAssetId}
            onRemove={handleRemoveAttachment}
          />
        </Animated.View>
        {/* Text input row. */}
        <Animated.View style={inputStyle}>
          <TextInput
            ref={inputRef}
            multiline
            scrollEnabled={false}
            value={message}
            onChangeText={setMessage}
            onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
            placeholder={isRecording ? 'Listening…' : 'Write a note, ask something…'}
            placeholderTextColor={themeColors['text-tertiary']}
            cursorColor={themeColors.accent}
            selectionColor={themeColors.accent}
            style={styles.input}
            testID="feed-composer-input"
          />
        </Animated.View>
        {/* Action row. */}
        <View style={styles.buttonRow}>
          <View style={styles.mediaGroup}>
            <Pressable
              accessibilityLabel="Add attachment"
              accessibilityRole="button"
              hitSlop={spacing[2]}
              onPress={showPlusMenu}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.iconButtonPressed : null,
              ]}
            >
              <AppIcon name="plus" size={18} tintColor={themeColors['text-secondary']} />
            </Pressable>
          </View>
          <View style={styles.actionGroup}>
            <Pressable
              accessibilityLabel="Record voice note"
              accessibilityRole="button"
              hitSlop={spacing[2]}
              onPress={() => voiceModalRef.current?.present()}
              style={({ pressed }) => [
                styles.iconButton,
                pressed ? styles.iconButtonPressed : null,
              ]}
            >
              <AppIcon name="waveform" size={18} tintColor={themeColors['text-secondary']} />
            </Pressable>
            <GlassActionButton
              onSave={() => void handleSave()}
              onChat={() => void handleChat()}
              disabled={!canSubmit || isSaving || isChatCreating}
            />
          </View>
        </View>
      </Animated.View>

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => setIsCameraOpen(false));
        }}
        onClose={() => setIsCameraOpen(false)}
      />
      <VoiceSessionModal
        bottomSheetModalRef={voiceModalRef}
        onAudioTranscribed={(transcript) => {
          handleVoiceTranscript(transcript);
        }}
        onClose={() => {
          setIsRecording(false);
          setMode('text');
        }}
      />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles((theme) => ({
  container: {
    left: 0,
    right: 0,
    paddingHorizontal: spacing[2],
    position: 'absolute',
    alignItems: 'center',
  },
  // Floating surface that contains the composer content.
  surface: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    overflow: 'visible', // so GlassActionButton chat option can float above
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  // Separate clipping container so blur is clipped to pill shape
  // while the outer pill can still overflow its children
  blurClip: {
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  specHighlight: {
    position: 'absolute',
    top: 0,
    left: spacing[4],
    right: spacing[4],
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 1,
  },
  // Active state — text row (full width)
  input: {
    color: theme.colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  // Active state — button row below text
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    width: 32,
  },
  iconButtonPressed: {
    opacity: 0.65,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  // Attachments
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    paddingBottom: spacing[1],
  },
  thumb: {
    width: spacing[4] * 3,
    height: spacing[4] * 3,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors['bg-surface'],
  },
  thumbImage: {
    width: spacing[4] * 3,
    height: spacing[4] * 3,
  },
  thumbBadge: {
    position: 'absolute',
    top: spacing[1],
    right: spacing[1],
    width: spacing[2] * 2,
    height: spacing[2] * 2,
    borderRadius: radii.sm,
    backgroundColor: theme.colors['overlay-modal-high'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors['overlay-modal-medium'],
  },
  progressHost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: spacing[1],
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.destructive,
  },
}));
