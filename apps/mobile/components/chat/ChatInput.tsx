import { ProgressView, Host as SwiftUIHost } from '@expo/ui/swift-ui';
import { frame, progressViewStyle } from '@expo/ui/swift-ui/modifiers';
import { useApiClient } from '@hominem/rpc/react';
import type { NoteSearchResult } from '@hominem/rpc/types';
import { radii, spacing } from '@hominem/ui/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { SFSymbol } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildChatTitle,
  canSubmitComposerDraft,
  getSelectedNoteIds,
  getUploadedAttachmentIds,
  isDefaultChatTitle,
} from '~/components/composer/composerActions';
import type { ComposerAttachment, ComposerSelectedNote } from '~/components/composer/composerState';
import {
  getTrailingMentionQuery,
  removeTrailingMentionQuery,
} from '~/components/composer/note-mentions';
import { useComposerMediaActions } from '~/components/composer/useComposerMediaActions';
import { CameraModal } from '~/components/media/camera-modal';
import { makeStyles, useThemeColors } from '~/components/theme';
import { createLayoutTransition } from '~/components/theme/animations';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useTextEnhance } from '~/services/ai/use-text-enhance';
import { updateChatTitleCaches, useActiveChat, useSendMessage } from '~/services/chat';
import { chatKeys } from '~/services/notes/query-keys';
import { useNoteSearch } from '~/services/notes/use-note-search';
import t from '~/translations';

// ── Layout constants ──────────────────────────────────────────────────────────

const MAX_WIDTH = 500;
const PILL_RADIUS = 20;
const INPUT_MIN_H = spacing[6] + spacing[4]; // 48px
const INPUT_MAX_H = spacing[6] * 9; // 288px
const BTN_SIZE = spacing[6]; // 32px
const BTN_ICON_SIZE = spacing[4] + 2; // 18px
const MEDIA_BTN_SIZE = spacing[5] + 2; // 26px
const MEDIA_BTN_ICON_SIZE = spacing[4] + 4; // 20px

// ── Sub-components ────────────────────────────────────────────────────────────

function MediaButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  icon: SFSymbol;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.mediaBtn,
        disabled ? styles.mediaBtnDisabled : null,
        pressed ? styles.mediaBtnPressed : null,
      ]}
    >
      <AppIcon name={icon} size={MEDIA_BTN_ICON_SIZE} tintColor={themeColors['text-secondary']} />
    </Pressable>
  );
}

function SendButton({
  onPress,
  disabled,
  isSending,
}: {
  onPress: () => void;
  disabled: boolean;
  isSending: boolean;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={isSending ? t.chat.input.sendingA11y : t.chat.input.sendMessageA11y}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.sendBtn,
        disabled ? styles.sendBtnDisabled : null,
        pressed && !disabled ? styles.sendBtnPressed : null,
      ]}
    >
      <AppIcon
        name="arrow.up"
        size={BTN_ICON_SIZE}
        tintColor={disabled ? themeColors['text-tertiary'] : '#ffffff'}
      />
    </Pressable>
  );
}

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
    <View style={styles.attachments}>
      {attachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.attachmentRow}
        >
          {attachments.map((a) => {
            const progress = progressByAssetId[a.id] ?? 0;
            const uploading = progress > 0 && progress < 100;
            return (
              <Pressable
                key={a.id}
                style={styles.thumb}
                onPress={() => onRemove(a.id)}
                accessibilityLabel={t.notes.editor.removeFile(a.name)}
                accessibilityRole="button"
              >
                {a.localUri && (
                  <Image
                    source={{ uri: a.localUri }}
                    style={styles.thumbImage}
                    contentFit="cover"
                  />
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
        </ScrollView>
      )}
      {errors.length > 0 && (
        <Animated.Text style={styles.errorText}>{errors.join(' · ')}</Animated.Text>
      )}
    </View>
  );
}

function SelectionSummary({
  selectedNotes,
  onRemove,
}: {
  selectedNotes: ComposerSelectedNote[];
  onRemove: (noteId: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  if (selectedNotes.length === 0) return null;

  return (
    <View style={styles.selectionRow}>
      {selectedNotes.map((note) => (
        <View key={note.id} style={styles.selectionChip}>
          <AppIcon name="bubble.left" size={spacing[3]} tintColor={themeColors['text-secondary']} />
          <Animated.Text style={styles.selectionChipText}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          <Pressable
            accessibilityLabel={t.chat.input.removeNoteA11y(
              note.title ?? t.workspace.item.untitled,
            )}
            accessibilityRole="button"
            hitSlop={spacing[2]}
            onPress={() => onRemove(note.id)}
            style={({ pressed }) => [
              styles.selectionChipButton,
              pressed ? styles.selectionChipButtonPressed : null,
            ]}
          >
            <AppIcon name="xmark" size={spacing[2] + 2} tintColor={themeColors['text-secondary']} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function MentionSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: NoteSearchResult[];
  onSelect: (note: NoteSearchResult) => void;
}) {
  const styles = useStyles();

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.suggestions}>
      {suggestions.map((note) => (
        <Pressable
          key={note.id}
          accessibilityLabel={t.chat.input.linkNoteA11y(note.title ?? t.workspace.item.untitled)}
          accessibilityRole="button"
          onPress={() => onSelect(note)}
          style={({ pressed }) => [
            styles.suggestionItem,
            pressed ? styles.suggestionItemPressed : null,
          ]}
        >
          <Animated.Text style={styles.suggestionTitle}>
            {note.title || t.workspace.item.untitledNote}
          </Animated.Text>
          {note.excerpt ? (
            <Animated.Text numberOfLines={1} style={styles.suggestionExcerpt}>
              {note.excerpt}
            </Animated.Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChatInputProps {
  chatId: string;
  initialMessage?: string;
}

export function ChatInput({ chatId, initialMessage }: ChatInputProps) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const styles = useStyles();
  const isDark = useColorScheme() === 'dark';
  const blurTint = isDark ? ('dark' as const) : ('light' as const);
  const pillOverlayColor = isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.6)';
  const pillBorderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const prefersReducedMotion = useReducedMotion();
  const animatedH = useSharedValue(INPUT_MIN_H);
  const wandProgress = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;

  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<ComposerSelectedNote[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const { handleCameraCapture, pickAttachment, uploadState } = useComposerMediaActions({
    attachments,
    setAttachments,
  });

  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: resolvedChatId });
  const { enhance, isEnhancing } = useTextEnhance();

  const uploadedAttachmentIds = useMemo(() => getUploadedAttachmentIds(attachments), [attachments]);

  const canSubmit = canSubmitComposerDraft({
    isUploading: uploadState.isUploading,
    message,
    uploadedAttachmentIds,
    selectedNotes,
  });

  const clearDraft = useCallback(() => {
    setMessage('');
    setAttachments([]);
    setSelectedNotes([]);
    animatedH.value = INPUT_MIN_H;
  }, [animatedH]);

  const mentionQuery = useMemo(() => getTrailingMentionQuery(message), [message]);
  const { data: searchResults } = useNoteSearch(mentionQuery ?? '', mentionQuery !== null);
  const mentionSuggestions = useMemo(
    () =>
      (searchResults?.notes ?? []).filter((note) => !selectedNotes.some((s) => s.id === note.id)),
    [searchResults?.notes, selectedNotes],
  );

  const handleSelectMention = useCallback(
    (note: NoteSearchResult) => {
      setMessage(removeTrailingMentionQuery(message));
      setSelectedNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      inputRef.current?.focus();
    },
    [message],
  );

  const handleRemoveNote = useCallback((noteId: string) => {
    setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // Auto-send initialMessage once on mount (used when navigating from FeedComposer → chat)
  const hasSentInitial = useRef(false);
  const initialMessageRef = useRef(initialMessage);
  const sendRef = useRef(sendChatMessage);
  sendRef.current = sendChatMessage;
  useEffect(() => {
    const text = initialMessageRef.current?.trim();
    if (!text || hasSentInitial.current) return;
    hasSentInitial.current = true;
    void sendRef.current({ message: text });
  }, []); // intentionally empty — fire once on mount only

  const handleSend = useCallback(() => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    const noteIds = getSelectedNoteIds(selectedNotes);
    void sendChatMessage({
      message: trimmedMessage,
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      ...(noteIds.length > 0 ? { noteIds } : {}),
      ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
    }).then(async () => {
      if (trimmedMessage.length > 0) {
        const currentChat = queryClient.getQueryData<{ title: string } | null>(
          chatKeys.activeChat(resolvedChatId),
        );
        if (currentChat && isDefaultChatTitle(currentChat.title)) {
          const nextTitle = buildChatTitle(trimmedMessage);
          if (!isDefaultChatTitle(nextTitle)) {
            const updatedAt = new Date().toISOString();
            updateChatTitleCaches(queryClient, {
              chatId: resolvedChatId,
              title: nextTitle,
              updatedAt,
            });
            try {
              await client.api.chats[':id'].$patch({
                param: { id: resolvedChatId },
                json: { title: nextTitle },
              });
            } catch {
              await queryClient.invalidateQueries({
                queryKey: chatKeys.activeChat(resolvedChatId),
              });
            }
          }
        }
      }
      clearDraft();
    });
  }, [
    canSubmit,
    isChatSending,
    message,
    selectedNotes,
    uploadedAttachmentIds,
    sendChatMessage,
    queryClient,
    resolvedChatId,
    client,
    clearDraft,
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
      {
        options: [
          t.chat.input.actionSheet.cancel,
          t.chat.input.actionSheet.takePhoto,
          t.chat.input.actionSheet.chooseFromLibrary,
        ],
        cancelButtonIndex: 0,
      },
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
    maxHeight: animatedH.value,
  }));

  useEffect(() => {
    wandProgress.value = withTiming(message.trim().length > 0 ? 1 : 0, { duration: 180 });
  }, [message, wandProgress]);

  const wandStyle = useAnimatedStyle(() => ({
    opacity: wandProgress.value,
    transform: [{ translateY: (1 - wandProgress.value) * 6 }],
  }));

  return (
    <Animated.View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
      <Animated.View
        layout={createLayoutTransition(prefersReducedMotion)}
        style={[styles.pill, { borderColor: pillBorderColor }]}
        testID="chat-input"
      >
        {/* Glass background */}
        <View style={[StyleSheet.absoluteFill, styles.blurClip]}>
          <BlurView intensity={24} tint={blurTint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: pillOverlayColor }]} />
        </View>
        {/* Specular top-edge highlight */}
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
        <SelectionSummary selectedNotes={selectedNotes} onRemove={handleRemoveNote} />
        <MentionSuggestions suggestions={mentionSuggestions} onSelect={handleSelectMention} />
        <View style={styles.inputRow}>
          <Animated.View style={[styles.inputSurface, inputStyle]}>
            <TextInput
              ref={inputRef}
              multiline
              scrollEnabled={false}
              value={message}
              onChangeText={setMessage}
              onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
              placeholder={t.chat.input.messagePlaceholder}
              placeholderTextColor={themeColors['text-tertiary']}
              cursorColor={themeColors.accent}
              selectionColor={themeColors.accent}
              style={styles.input}
              testID="chat-input-field"
            />
          </Animated.View>
        </View>
        <View style={styles.actionRow}>
          <MediaButton
            icon="plus"
            onPress={showPlusMenu}
            accessibilityLabel={t.chat.input.addAttachmentA11y}
            disabled={isChatSending}
          />
          <View style={styles.actionRowSpacer} />
          <Animated.View
            style={wandStyle}
            pointerEvents={message.trim().length > 0 ? 'auto' : 'none'}
          >
            <MediaButton
              icon="wand.and.sparkles"
              onPress={() => void enhance(message).then(setMessage)}
              accessibilityLabel={t.chat.input.enhanceTextA11y}
              disabled={isChatSending || isEnhancing}
            />
          </Animated.View>
          <SendButton
            onPress={handleSend}
            disabled={!canSubmit || isChatSending}
            isSending={isChatSending}
          />
        </View>
      </Animated.View>

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => setIsCameraOpen(false));
        }}
        onClose={() => setIsCameraOpen(false)}
      />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles((theme) => ({
  shell: {
    paddingHorizontal: spacing[4],
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderRadius: PILL_RADIUS,
    borderCurve: 'continuous',
    overflow: 'visible',
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  actionRowSpacer: {
    flex: 1,
  },
  inputSurface: {
    flex: 1,
  },
  input: {
    color: theme.colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  sendBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: radii.sm,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: theme.colors['bg-base'],
    borderWidth: 1,
    borderColor: theme.colors['border-default'],
  },
  sendBtnPressed: {
    opacity: 0.7,
  },
  mediaBtn: {
    width: MEDIA_BTN_SIZE,
    height: MEDIA_BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  mediaBtnDisabled: {
    opacity: 0.4,
  },
  mediaBtnPressed: {
    backgroundColor: theme.colors['bg-surface'],
  },
  attachments: {
    gap: spacing[2],
  },
  attachmentRow: {
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
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  selectionChip: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  selectionChipButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    height: spacing[4],
    justifyContent: 'center',
    width: spacing[4],
  },
  selectionChipButtonPressed: {
    backgroundColor: theme.colors.background,
  },
  selectionChipText: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
  suggestions: {
    backgroundColor: theme.colors['bg-surface'],
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionItem: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  suggestionItemPressed: {
    backgroundColor: theme.colors.background,
  },
  suggestionTitle: {
    color: theme.colors.foreground,
    fontSize: 12,
    lineHeight: 16,
  },
  suggestionExcerpt: {
    color: theme.colors['text-secondary'],
    fontSize: 12,
    lineHeight: 16,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.destructive,
  },
}));
