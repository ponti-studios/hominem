import { colors, spacing } from '@hominem/ui/tokens';
import { shadowsNative } from '@hominem/ui/tokens/shadows';
import React, { useState, useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createNotesEnterLift,
  createNotesExitLift,
  createNotesLayoutTransition,
} from '~/components/notes/notes-surface-motion';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { Text, theme } from '~/components/theme';
import { useNoteStream } from '~/services/notes/use-note-stream';

import { CameraModal } from '../media/camera-modal';
import { VoiceSessionModal } from '../media/voice-session-modal';
import { useInputContext } from './input-context';
import { deriveMobileComposerPresentation, type MobileComposerAttachment } from './composer-state';
import { useComposerSubmission } from './use-composer-submission';
import { useComposerMediaActions } from './use-composer-media-actions';

const COMPOSER_MAX_WIDTH = 500;
const COMPOSER_MAX_HEIGHT = 300;
const COMPOSER_INPUT_MIN_HEIGHT = 40;
const COMPOSER_INPUT_MIN_COMPACT = 56;
const COMPOSER_INPUT_MAX_EXPANDED = 300;
const COMPOSER_COMPACT_INPUT_MIN_HEIGHT = 56;
const COMPOSER_COMPACT_MIN_HEIGHT = 96;
const COMPOSER_PANEL_RADIUS = 24;
const COMPOSER_PILL_RADIUS = 9999;

function ComposerNoteChips({
  selectedNoteIds,
  toggleSelectedNoteId,
}: {
  selectedNoteIds: string[];
  toggleSelectedNoteId: (noteId: string) => void;
}) {
  const { data: notes = [] } = useNoteStream();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      testID="mobile-composer-note-chips"
    >
      {notes.slice(0, 20).map((note) => {
        const selected = selectedNoteIds.includes(note.id);

        return (
          <Pressable
            key={note.id}
            style={[styles.chip, selected && styles.chipActive]}
            onPress={() => toggleSelectedNoteId(note.id)}
          >
            <Text color={selected ? 'foreground' : 'text-secondary'}>
              {note.title || 'Untitled'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ComposerAttachments({
  attachments,
  errors,
  isUploading,
  onRemoveAttachment,
}: {
  attachments: MobileComposerAttachment[];
  errors: string[];
  isUploading: boolean;
  onRemoveAttachment: (attachmentId: string) => void;
}) {
  if (attachments.length === 0 && errors.length === 0 && !isUploading) {
    return null;
  }

  return (
    <View style={styles.attachmentsSection}>
      {attachments.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {attachments.map((attachment) => (
            <Pressable
              key={attachment.id}
              style={styles.attachmentThumbnail}
              onPress={() => onRemoveAttachment(attachment.id)}
            >
              {attachment.localUri && (
                <Image
                  source={{ uri: attachment.localUri }}
                  style={styles.attachmentImage}
                  contentFit="cover"
                />
              )}
              {isUploading && (
                <View style={styles.uploadProgress}>
                  <Text color="foreground" style={styles.progressText}>
                    0%
                  </Text>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {isUploading ? <Text color="text-secondary">Uploading…</Text> : null}
      {errors.length > 0 ? <Text color="destructive">{errors.join(', ')}</Text> : null}
    </View>
  );
}

function ComposerFooter({
  canSubmit,
  isSending,
  presentation,
  onPickAttachment,
  onOpenCamera,
  onOpenVoice,
  onPrimaryAction,
  onSecondaryAction,
}: {
  canSubmit: boolean;
  isSending: boolean;
  presentation: ReturnType<typeof deriveMobileComposerPresentation>;
  onPickAttachment: () => void;
  onOpenCamera: () => void;
  onOpenVoice: () => void;
  onPrimaryAction: () => void;
  onSecondaryAction: (() => void) | null;
}) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerActions}>
        {presentation.showsAttachmentButton ? (
          <Pressable style={styles.actionButton} onPress={onPickAttachment}>
            <Text color="foreground">LIBRARY</Text>
          </Pressable>
        ) : null}
        {presentation.showsAttachmentButton ? (
          <Pressable style={styles.actionButton} onPress={onOpenCamera}>
            <Text color="foreground">CAMERA</Text>
          </Pressable>
        ) : null}
        {presentation.showsVoiceButton ? (
          <Pressable style={styles.actionButton} onPress={onOpenVoice}>
            <Text color="foreground">VOICE</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.submitActions}>
        {presentation.secondaryActionLabel && onSecondaryAction ? (
          <Pressable style={styles.actionButton} onPress={onSecondaryAction}>
            <Text color="foreground">{presentation.secondaryActionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
          onPress={onPrimaryAction}
          disabled={!canSubmit}
          testID="mobile-composer-primary-action"
        >
          <Text color="foreground">{isSending ? 'SENDING' : presentation.primaryActionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const MobileComposer = () => {
  const insets = useSafeAreaInsets();
  const [inputHeight, setInputHeight] = useState(COMPOSER_INPUT_MIN_COMPACT);
  const animatedInputHeight = useSharedValue(COMPOSER_INPUT_MIN_COMPACT);

  const {
    target,
    attachments,
    clearDraft,
    isRecording,
    message,
    mode,
    selectedNoteIds,
    setAttachments,
    setIsRecording,
    setMessage,
    setMode,
    toggleSelectedNoteId,
  } = useInputContext();
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
    selectedNoteIds,
    isUploading: uploadState.isUploading,
    setAttachments,
    clearDraft,
  });
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const keyboard = useAnimatedKeyboard();
  const prefersReducedMotion = useReducedMotion();

  const presentation = deriveMobileComposerPresentation(
    target,
    message.trim().length > 0 || attachments.length > 0,
    isRecording,
  );

  const handleInputContentSizeChange = useCallback(
    (newHeight: number) => {
      const clampedHeight = Math.min(
        Math.max(newHeight, COMPOSER_INPUT_MIN_COMPACT),
        COMPOSER_INPUT_MAX_EXPANDED,
      );
      setInputHeight(clampedHeight);
      animatedInputHeight.value = withSpring(clampedHeight, {
        damping: 18,
        stiffness: 200,
        mass: 0.8,
      });
    },
    [animatedInputHeight],
  );

  const animatedInputStyle = useAnimatedStyle(() => ({
    minHeight: animatedInputHeight.value,
    maxHeight: animatedInputHeight.value,
  }));

  if (presentation.isHidden) {
    return null;
  }

  const animatedShellStyle = useAnimatedStyle(() => ({
    bottom: keyboard.height.value + Math.max(insets.bottom, 10),
  }));

  return (
    <Animated.View
      entering={createNotesEnterLift(prefersReducedMotion)}
      exiting={createNotesExitLift(prefersReducedMotion)}
      style={[styles.shell, animatedShellStyle]}
    >
      <Animated.View
        layout={createNotesLayoutTransition(prefersReducedMotion)}
        style={[styles.container, presentation.isCompact ? styles.containerCompact : null]}
        testID="mobile-composer"
      >
        {presentation.showsNoteChips ? (
          <ComposerNoteChips
            selectedNoteIds={selectedNoteIds}
            toggleSelectedNoteId={toggleSelectedNoteId}
          />
        ) : null}

        <Animated.View style={animatedInputStyle}>
          <TextInput
            multiline
            onChangeText={setMessage}
            onContentSizeChange={(event) =>
              handleInputContentSizeChange(event.nativeEvent.contentSize.height)
            }
            placeholder={presentation.placeholder}
            placeholderTextColor={theme.colors['text-tertiary']}
            style={[styles.input, presentation.isCompact ? styles.inputCompact : null]}
            testID="mobile-composer-input"
            value={message}
          />
        </Animated.View>

        <Animated.View layout={createNotesLayoutTransition(prefersReducedMotion)}>
          <ComposerAttachments
            attachments={attachments}
            errors={uploadState.errors}
            isUploading={uploadState.isUploading}
            onRemoveAttachment={handleRemoveAttachment}
          />
        </Animated.View>

        <ComposerFooter
          canSubmit={canSubmit}
          isSending={isChatSending}
          presentation={presentation}
          onPickAttachment={() => {
            void pickAttachment();
          }}
          onOpenCamera={() => setIsCameraOpen(true)}
          onOpenVoice={() => {
            setMode(mode === 'voice' ? mode : 'voice');
            setIsRecording(true);
            setIsVoiceModalOpen(true);
          }}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={presentation.secondaryActionLabel ? handleSecondaryAction : null}
        />
      </Animated.View>

      <CameraModal
        visible={isCameraOpen}
        onCapture={(photo) => {
          void handleCameraCapture(photo).finally(() => {
            setIsCameraOpen(false);
          });
        }}
        onClose={() => setIsCameraOpen(false)}
      />
      <VoiceSessionModal
        onAudioTranscribed={(transcript) => {
          handleVoiceTranscript(transcript);
          setIsVoiceModalOpen(false);
        }}
        onClose={() => {
          setIsRecording(false);
          setMode('text');
          setIsVoiceModalOpen(false);
        }}
        visible={isVoiceModalOpen}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  shell: {
    left: 0,
    paddingHorizontal: spacing[2],
    position: 'absolute',
    right: 0,
    alignItems: 'center',
  },
  container: {
    gap: spacing[3],
    width: '100%',
    maxWidth: COMPOSER_MAX_WIDTH,
    backgroundColor: colors['bg-base'],
    borderWidth: 1,
    borderColor: colors['border-subtle'],
    borderRadius: COMPOSER_PANEL_RADIUS,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[2],
    overflow: 'hidden',
    ...shadowsNative.medium,
  },
  containerCompact: {
    minHeight: COMPOSER_COMPACT_MIN_HEIGHT,
  },
  input: {
    color: theme.colors.foreground,
    fontSize: 16,
    minHeight: COMPOSER_INPUT_MIN_HEIGHT,
    maxHeight: COMPOSER_INPUT_MAX_EXPANDED,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  inputCompact: {
    minHeight: COMPOSER_COMPACT_INPUT_MIN_HEIGHT,
  },
  attachmentsSection: {
    gap: spacing[2],
  },
  chips: {
    gap: spacing[2],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors['border-subtle'],
    borderRadius: COMPOSER_PILL_RADIUS,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  chipActive: {
    backgroundColor: theme.colors.muted,
  },
  attachmentThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.muted,
    position: 'relative',
  },
  attachmentImage: {
    width: 48,
    height: 48,
  },
  uploadProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[3],
    alignItems: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
    flex: 1,
  },
  submitActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing[2],
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors['border-subtle'],
    borderRadius: COMPOSER_PILL_RADIUS,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  primaryButton: {
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: colors['border-subtle'],
    borderRadius: COMPOSER_PILL_RADIUS,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
});
