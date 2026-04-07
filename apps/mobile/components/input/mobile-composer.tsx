import { CHAT_TITLE_MAX_LENGTH } from '@hominem/chat/constants';
import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { colors, spacing } from '@hominem/ui/tokens';
import { shadowsNative } from '@hominem/ui/tokens/shadows';
import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createNotesEnterLift,
  createNotesExitLift,
  createNotesLayoutTransition,
} from '~/components/notes/notes-surface-motion';
import { donateAddNoteIntent } from '~/lib/intent-donation';
import { useReducedMotion } from '~/lib/use-reduced-motion';
import { Text, theme } from '~/theme';
import { useSendMessage } from '~/utils/services/chat';
import type { ChatWithActivity } from '~/utils/services/chat/session-state';
import {
  createChatInboxRefreshSnapshot,
  invalidateInboxQueries,
  upsertInboxSessionActivity,
} from '~/utils/services/inbox/inbox-refresh';
import { chatKeys, noteKeys } from '~/utils/services/notes/query-keys';
import { useCreateNote } from '~/utils/services/notes/use-create-note';
import { useNoteQuery } from '~/utils/services/notes/use-note-query';
import { useNoteStream } from '~/utils/services/notes/use-note-stream';

import { CameraModal } from '../media/camera-modal';
import { VoiceSessionModal } from '../media/voice-session-modal';
import {
  deriveMobileComposerPresentation,
  useInputContext,
  type MobileComposerAttachment,
} from './input-context';
import { useComposerMediaActions } from './use-composer-media-actions';

const COMPOSER_MAX_WIDTH = 500;
const COMPOSER_MAX_HEIGHT = 150;
const COMPOSER_INPUT_MIN_HEIGHT = 40;
const COMPOSER_COMPACT_INPUT_MIN_HEIGHT = 56;
const COMPOSER_COMPACT_MIN_HEIGHT = 96;
const COMPOSER_PANEL_RADIUS = 24;
const COMPOSER_PILL_RADIUS = 9999;

function getUploadedAttachmentIds(attachments: MobileComposerAttachment[]) {
  return attachments.flatMap((attachment) =>
    attachment.uploadedFile?.id ? [attachment.uploadedFile.id] : [],
  );
}

function mergeNoteIntoCache(currentNotes: Note[] | undefined, updatedNote: Note) {
  if (!currentNotes) {
    return [updatedNote];
  }

  const hasNote = currentNotes.some((note) => note.id === updatedNote.id);
  if (!hasNote) {
    return [updatedNote, ...currentNotes];
  }

  return currentNotes.map((note) => (note.id === updatedNote.id ? updatedNote : note));
}

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
              style={styles.chip}
              onPress={() => onRemoveAttachment(attachment.id)}
            >
              <Text color="text-secondary">{attachment.name}</Text>
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
  const client = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync: createNote } = useCreateNote();
  const insets = useSafeAreaInsets();
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
  const noteQuery = useNoteQuery({
    noteId: target.noteId ?? '',
    enabled: target.kind === 'note' && Boolean(target.noteId),
  });
  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: target.chatId ?? '' });
  const { handleCameraCapture, handleVoiceTranscript, pickAttachment, uploadState } =
    useComposerMediaActions({
      attachments,
      setAttachments,
      message,
      setMessage,
      setIsRecording,
      setMode,
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
  const uploadedAttachmentIds = useMemo(() => getUploadedAttachmentIds(attachments), [attachments]);
  const canSubmit =
    !uploadState.isUploading && (message.trim().length > 0 || uploadedAttachmentIds.length > 0);

  const createNoteFromDraft = async () => {
    await createNote({
      text: message.trim(),
      ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
    });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
    clearDraft();
  };

  const createChatFromDraft = async () => {
    const trimmedMessage = message.trim();
    const chatTitle = trimmedMessage.slice(0, CHAT_TITLE_MAX_LENGTH) || 'New conversation';
    const chat = await client.chats.create({
      title: chatTitle,
    });

    if (trimmedMessage || uploadedAttachmentIds.length > 0) {
      await client.chats.send({
        chatId: chat.id,
        message: trimmedMessage,
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
      });
    }

    queryClient.setQueryData<ChatWithActivity[] | undefined>(
      chatKeys.resumableSessions,
      (previousSessions) =>
        upsertInboxSessionActivity(
          previousSessions ?? [],
          createChatInboxRefreshSnapshot({
            chatId: chat.id,
            noteId: chat.noteId,
            title: chat.title,
            timestamp: chat.createdAt,
            userId: chat.userId,
          }),
        ),
    );
    await invalidateInboxQueries(queryClient);
    clearDraft();
    router.push(`/(protected)/(tabs)/chat/${chat.id}` as RelativePathString);
  };

  const appendToCurrentNote = async () => {
    const note = noteQuery.data;

    if (!note) {
      return;
    }

    const trimmedMessage = message.trim();
    const nextContent =
      trimmedMessage.length === 0
        ? note.content
        : note.content.trim().length > 0
          ? `${note.content}\n\n${trimmedMessage}`
          : trimmedMessage;
    const nextFileIds = Array.from(
      new Set([...note.files.map((file) => file.id), ...uploadedAttachmentIds]),
    );
    const updatedNote = await client.notes.update({
      id: note.id,
      title: note.title ?? null,
      content: nextContent,
      fileIds: nextFileIds,
    });

    queryClient.setQueryData(noteKeys.detail(note.id), updatedNote);
    queryClient.setQueryData<Note[]>(noteKeys.all, (currentNotes) =>
      mergeNoteIntoCache(currentNotes, updatedNote),
    );
    await invalidateInboxQueries(queryClient);
    clearDraft();
  };

  const handlePrimaryAction = () => {
    if (!canSubmit) {
      return;
    }

    if (target.kind === 'chat') {
      void sendChatMessage({
        message: message.trim(),
        ...(uploadedAttachmentIds.length > 0 ? { fileIds: uploadedAttachmentIds } : {}),
        ...(selectedNoteIds.length > 0 ? { noteIds: selectedNoteIds } : {}),
      }).then(() => {
        clearDraft();
      });
      return;
    }

    if (target.kind === 'note') {
      void appendToCurrentNote();
      return;
    }

    void createNoteFromDraft();
  };

  const handleSecondaryAction = () => {
    if (target.kind === 'feed') {
      void createChatFromDraft();
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const attachmentToRemove = attachments.find((attachment) => attachment.id === attachmentId);

    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );

    if (attachmentToRemove?.uploadedFile?.id) {
      void client.files
        .delete({
          fileId: attachmentToRemove.uploadedFile.id,
        })
        .catch(() => undefined);
    }
  };

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

        <TextInput
          multiline
          onChangeText={setMessage}
          placeholder={presentation.placeholder}
          placeholderTextColor={theme.colors['text-tertiary']}
          style={[styles.input, presentation.isCompact ? styles.inputCompact : null]}
          testID="mobile-composer-input"
          value={message}
        />

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
    maxHeight: COMPOSER_MAX_HEIGHT,
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
