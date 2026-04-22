import { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { NoteSearchResult } from '@hominem/rpc/types';
import { radii, shadowsNative, spacing } from '@hominem/ui/tokens';
import { Image } from 'expo-image';
import { type SFSymbol } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { createEnter, createExit, createLayoutTransition } from '~/components/theme/animations';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useNoteSearch } from '~/services/notes/use-note-search';

import { CameraModal } from '../media/camera-modal';
import { VoiceSessionModal } from '../media/voice-session-modal';
import { useComposerContext } from './ComposerContext';
import {
  deriveComposerPresentation,
  type ComposerAttachment,
  type ComposerSelectedNote,
} from './composerState';
import { getTrailingMentionQuery, removeTrailingMentionQuery } from './note-mentions';
import { useComposerMediaActions } from './useComposerMediaActions';
import { useComposerSubmission } from './useComposerSubmission';

const MAX_WIDTH = 500;

const INPUT_MIN_H = spacing[6] + spacing[4];
const INPUT_MAX_H = spacing[6] * 9;

const SEND_BTN_SIZE = spacing[6];
const SEND_ICON_SIZE = spacing[4] + 2;
const SECONDARY_BTN_SIZE = spacing[5] + 2;
const SECONDARY_ICON_SIZE = spacing[4] + 4;

function SendButton({
  onPress,
  disabled,
  accessibilityLabel,
}: {
  onPress: () => void;
  disabled: boolean;
  accessibilityLabel: string;
}) {
  const themeColors = useThemeColors();
  const styles = useComposerStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.sendBtn,
        disabled ? styles.sendBtnDisabled : null,
        pressed && !disabled ? styles.sendBtnPressed : null,
      ]}
    >
      <AppIcon
        name="arrow.up"
        size={SEND_ICON_SIZE}
        color={disabled ? themeColors['text-tertiary'] : themeColors['bg-base']}
      />
    </Pressable>
  );
}

function SecondaryButton({
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
  const styles = useComposerStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={spacing[2]}
      style={({ pressed }) => [
        styles.secondaryBtn,
        disabled ? styles.secondaryBtnDisabled : null,
        pressed ? styles.secondaryBtnPressed : null,
      ]}
    >
      <AppIcon name={icon} size={SECONDARY_ICON_SIZE} color={themeColors['text-secondary']} />
    </Pressable>
  );
}

function ComposerAttachments({
  attachments,
  errors,
  isUploading,
  progressByAssetId,
  onRemoveAttachment,
}: {
  attachments: ComposerAttachment[];
  errors: string[];
  isUploading: boolean;
  progressByAssetId: Record<string, number>;
  onRemoveAttachment: (id: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useComposerStyles();

  if (attachments.length === 0 && errors.length === 0 && !isUploading) {
    return null;
  }

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
            const isUploading = progress > 0 && progress < 100;

            return (
              <Pressable
                key={a.id}
                style={styles.thumb}
                onPress={() => onRemoveAttachment(a.id)}
                accessibilityLabel={`Remove ${a.name}`}
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
                  <AppIcon name="xmark" size={spacing[2] * 2} color={themeColors.white} />
                </View>
                {isUploading && (
                  <>
                    <View style={styles.thumbDim} />
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
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

function ComposerSelectionSummary({
  selectedNotes,
  onRemoveNote,
}: {
  selectedNotes: ComposerSelectedNote[];
  onRemoveNote: (noteId: string) => void;
}) {
  const themeColors = useThemeColors();
  const styles = useComposerStyles();

  if (selectedNotes.length === 0) {
    return null;
  }

  return (
    <View style={styles.selectionRow}>
      {selectedNotes.map((note) => (
        <View key={note.id} style={styles.selectionChip}>
          <AppIcon name="bubble.left" size={spacing[3]} color={themeColors['text-secondary']} />
          <Animated.Text style={styles.selectionChipText}>
            {note.title || 'Untitled note'}
          </Animated.Text>
          <Pressable
            accessibilityLabel={`Remove ${note.title ?? 'note'}`}
            accessibilityRole="button"
            hitSlop={spacing[2]}
            onPress={() => onRemoveNote(note.id)}
            style={({ pressed }) => [
              styles.selectionChipButton,
              pressed ? styles.selectionChipButtonPressed : null,
            ]}
          >
            <AppIcon name="xmark" size={spacing[2] + 2} color={themeColors['text-secondary']} />
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
  const styles = useComposerStyles();

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.suggestions} testID="mobile-composer-mention-suggestions">
      {suggestions.map((note) => (
        <Pressable
          key={note.id}
          accessibilityLabel={`Link ${note.title ?? 'note'}`}
          accessibilityRole="button"
          onPress={() => onSelect(note)}
          style={({ pressed }) => [
            styles.suggestionItem,
            pressed ? styles.suggestionItemPressed : null,
          ]}
          testID={`mobile-composer-mention-${note.id}`}
        >
          <Animated.Text style={styles.suggestionTitle}>
            {note.title || 'Untitled note'}
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

export const Composer = () => {
  const insets = useSafeAreaInsets();
  const animatedH = useSharedValue(INPUT_MIN_H);
  const keyboard = useAnimatedKeyboard();
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef<TextInput>(null);
  const themeColors = useThemeColors();
  const styles = useComposerStyles();

  const {
    target,
    addSelectedNote,
    attachments,
    clearDraft,
    isRecording,
    message,
    removeSelectedNote,
    selectedNotes,
    setAttachments,
    setComposerClearance,
    setIsRecording,
    setMessage,
    setMode,
  } = useComposerContext();

  const { handleCameraCapture, handleVoiceTranscript, pickAttachment, uploadState } =
    useComposerMediaActions({
      attachments,
      setAttachments,
      message,
      setMessage,
      setIsRecording,
      setMode,
    });

  const {
    canSubmit,
    handlePrimaryAction,
    handleRemoveAttachment,
    handleSecondaryAction,
    isChatSending,
  } = useComposerSubmission({
    target,
    attachments,
    message,
    selectedNotes,
    isUploading: uploadState.isUploading,
    setAttachments,
    clearDraft,
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const voiceModalRef = useRef<BottomSheetModal>(null);

  const presentation = deriveComposerPresentation(
    target,
    message.trim().length > 0 || attachments.length > 0 || selectedNotes.length > 0,
    isRecording,
  );
  const mentionQuery = useMemo(
    () => (target.kind === 'chat' ? getTrailingMentionQuery(message) : null),
    [message, target.kind],
  );
  const { data: searchResults } = useNoteSearch(
    mentionQuery ?? '',
    target.kind === 'chat' && mentionQuery !== null,
  );
  const mentionSuggestions = useMemo(
    () =>
      (searchResults?.notes ?? []).filter(
        (note) => !selectedNotes.some((selectedNote) => selectedNote.id === note.id),
      ),
    [searchResults?.notes, selectedNotes],
  );

  const showPlusMenu = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take Photo', 'Choose from Library'],
        cancelButtonIndex: 0,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) {
          setIsCameraOpen(true);
        } else if (buttonIndex === 2) {
          void pickAttachment();
        }
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
    flex: 1,
    minHeight: animatedH.value,
    maxHeight: animatedH.value,
  }));

  const shellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
  }));

  useEffect(() => {
    if (presentation.isHidden) {
      setComposerClearance(0);
    }
  }, [presentation.isHidden, setComposerClearance]);

  useEffect(() => () => setComposerClearance(0), [setComposerClearance]);

  const handleSelectMention = useCallback(
    (note: NoteSearchResult) => {
      setMessage(removeTrailingMentionQuery(message));
      addSelectedNote(note);
      inputRef.current?.focus();
    },
    [addSelectedNote, message, setMessage],
  );

  if (presentation.isHidden) return null;

  return (
    <Animated.View
      entering={createEnter(prefersReducedMotion)}
      exiting={createExit(prefersReducedMotion)}
      style={[styles.shell, shellStyle]}
    >
      <Animated.View
        layout={createLayoutTransition(prefersReducedMotion)}
        onLayout={(event) => {
          setComposerClearance(
            event.nativeEvent.layout.height + Math.max(insets.bottom, spacing[2]),
          );
        }}
        style={styles.card}
        testID="mobile-composer"
      >
        <Animated.View layout={createLayoutTransition(prefersReducedMotion)}>
          <ComposerAttachments
            attachments={attachments}
            errors={uploadState.errors}
            isUploading={uploadState.isUploading}
            progressByAssetId={uploadState.progressByAssetId}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </Animated.View>
        <ComposerSelectionSummary onRemoveNote={removeSelectedNote} selectedNotes={selectedNotes} />
        <MentionSuggestions onSelect={handleSelectMention} suggestions={mentionSuggestions} />
        <Animated.View style={[styles.inputSurface, inputStyle]}>
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              multiline
              scrollEnabled={false}
              value={message}
              onChangeText={setMessage}
              onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
              placeholder={presentation.placeholder}
              placeholderTextColor={themeColors['text-tertiary']}
              cursorColor={themeColors.accent}
              selectionColor={themeColors.accent}
              style={styles.input}
              testID="mobile-composer-input"
            />
          </View>
        </Animated.View>
        <View style={styles.accessoryRow}>
          <View style={styles.accessoryLeft}>
            {presentation.showsAttachmentButton ? (
              <SecondaryButton
                icon="plus"
                onPress={showPlusMenu}
                accessibilityLabel="Add attachment"
                disabled={isChatSending}
              />
            ) : null}
            {presentation.showsVoiceButton ? (
              <SecondaryButton
                icon="waveform"
                onPress={() => voiceModalRef.current?.present()}
                accessibilityLabel="Record a voice message"
                disabled={isChatSending}
              />
            ) : null}
          </View>
          <View style={styles.accessoryRight}>
            {presentation.secondaryActionLabel ? (
              <SecondaryButton
                icon="bubble.left"
                onPress={handleSecondaryAction}
                accessibilityLabel={presentation.secondaryActionLabel ?? 'Start chat'}
                disabled={isChatSending}
              />
            ) : null}
            <SendButton
              onPress={handlePrimaryAction}
              disabled={!canSubmit || isChatSending}
              accessibilityLabel={isChatSending ? 'Sending…' : presentation.primaryActionLabel}
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
};

const useComposerStyles = makeStyles((theme) => ({
  shell: {
    left: 0,
    right: 0,
    paddingHorizontal: spacing[4],
    position: 'absolute',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    backgroundColor: theme.colors['bg-elevated'],
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing[1],
    paddingTop: spacing[1],
    paddingBottom: spacing[3],
    gap: spacing[2],
    overflow: 'hidden',
    ...shadowsNative.low,
  },
  inputSurface: {
    paddingHorizontal: spacing[1],
    paddingVertical: 0,
  },
  inputWrap: {
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
  accessoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'space-between',
  },
  accessoryLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
    flexShrink: 1,
  },
  accessoryRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  sendBtn: {
    width: SEND_BTN_SIZE,
    height: SEND_BTN_SIZE,
    borderRadius: radii.sm,
    backgroundColor: theme.colors.foreground,
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
  secondaryBtn: {
    width: SECONDARY_BTN_SIZE,
    height: SECONDARY_BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  secondaryBtnDisabled: {
    opacity: 0.4,
  },
  secondaryBtnPressed: {
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
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: spacing[1],
    backgroundColor: theme.colors.accent,
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
