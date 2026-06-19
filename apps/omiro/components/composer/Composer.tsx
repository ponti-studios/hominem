import { useQueryClient } from '@tanstack/react-query';
import type { RelativePathString } from 'expo-router';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAttachmentRow } from '~/components/composer/ComposerAttachmentRow';
import { ComposerProvider } from '~/components/composer/ComposerContext';
import { ComposerShell } from '~/components/composer/ComposerShell';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { ComposerToolbar } from '~/components/composer/ComposerToolbar';
import { useComposer } from '~/components/composer/useComposer';
import { useVoiceComposerInput } from '~/components/composer/useVoiceComposerInput';
import { useInlineEnhance } from '~/services/ai';
import {
  normalizeChatTitle,
  useActiveChat,
  useAutoUpdateChatTitle,
  useSendMessage,
} from '~/services/chat';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { donateAddNoteIntent } from '~/services/intent-donation';
import { useCreateNote } from '~/services/notes/use-create-note';
import {
  clearChatDraft,
  readChatDraft,
  writeChatDraft,
} from '~/services/workspace/launch-state';
import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';
import t from '~/translations';

// ─── Public API ──────────────────────────────────────────────────────────────

interface ComposerFeedProps {
  mode: 'feed';
  seedMessage?: string;
  initialDraft?: string;
  onDraftChange?: (msg: string) => void;
  onClearDraft?: () => void;
  testID?: string;
}

interface ComposerChatProps {
  mode: 'chat';
  chatId: string;
  seedMessage?: string;
  testID?: string;
}

export type ComposerProps = ComposerFeedProps | ComposerChatProps;

export function Composer(props: ComposerProps) {
  return (
    <ComposerProvider>
      {props.mode === 'feed' ? (
        <FeedComposerContent
          seedMessage={props.seedMessage}
          initialDraft={props.initialDraft}
          onDraftChange={props.onDraftChange}
          onClearDraft={props.onClearDraft}
          testID={props.testID}
        />
      ) : (
        <ChatComposerContent
          chatId={props.chatId}
          seedMessage={props.seedMessage}
          testID={props.testID}
        />
      )}
    </ComposerProvider>
  );
}

// ─── Feed mode ────────────────────────────────────────────────────────────────

interface FeedComposerContentProps {
  seedMessage?: string;
  initialDraft?: string;
  onDraftChange?: (msg: string) => void;
  onClearDraft?: () => void;
  testID?: string;
}

function FeedComposerContent({
  seedMessage,
  initialDraft,
  onDraftChange,
  onClearDraft,
  testID,
}: FeedComposerContentProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { requestTopReveal } = useTopAnchoredFeed();
  const { mutateAsync: createNote, isPending: isSaving } = useCreateNote();
  const { mutateAsync: createChat, isPending: isChatCreating } = useCreateChat();
  const inputRef = useRef<TextInput>(null);

  const { message, setMessage, uploadState, uploadedAttachmentIds, canSubmit, clearDraft } =
    useComposer({ initialDraft, seedMessage, onDraftChange, onExtraClearDraft: onClearDraft });

  const {
    handleVoicePress,
    isBusy: isVoiceBusy,
    isCleaningVoice,
    isRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceComposerInput({ message, setMessage });

  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance();

  useEffect(() => {
    if (!voiceError) return;
    Alert.alert(voiceError.title, voiceError.message, [{ text: 'OK', onPress: clearVoiceError }]);
  }, [clearVoiceError, voiceError]);

  const handleSave = useCallback(async () => {
    if (!canSubmit || isSaving) return;
    await createNote({ text: message.trim(), fileIds: uploadedAttachmentIds });
    donateAddNoteIntent();
    await invalidateInboxQueries(queryClient);
    requestTopReveal();
    clearDraft();
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

  const handleStartChat = useCallback(async () => {
    if (!canSubmit || isChatCreating) return;
    const title = normalizeChatTitle(message);
    const chat = await createChat({ title });
    clearDraft();
    router.push(
      getWorkspaceArtifactRoute('chat', chat.id, {
        initialMessage: message.trim(),
      }) as RelativePathString,
    );
    requestTopReveal();
  }, [canSubmit, isChatCreating, createChat, message, clearDraft, router, requestTopReveal]);

  const hasAttachments =
    uploadState.errors.length > 0 || uploadState.isUploading;

  return (
    <ComposerShell
      testID={testID ?? 'feed-composer'}
      accessory={hasAttachments ? <ComposerAttachmentRow /> : undefined}
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={t.feed.composer.placeholder}
          testID="feed-composer-input"
        />
      }
      inlinePanel={
        isEnhanceOpen ? (
          <InlineEnhanceTray
            instruction={enhanceInstruction}
            onInstructionChange={setEnhanceInstruction}
            onCancel={closeEnhance}
            onConfirm={() => void runEnhance({ text: message, onEnhanced: setMessage })}
            isEnhancing={isEnhancing}
            error={enhanceError}
          />
        ) : undefined
      }
      toolbar={
        <ComposerToolbar
          mode="feed"
          isRecording={isRecording}
          isVoiceBusy={isVoiceBusy}
          isEnhancing={isEnhancing}
          isCleaningVoice={isCleaningVoice}
          canSubmit={canSubmit}
          isSubmitting={isSaving || isChatCreating}
          onVoicePress={() => void handleVoicePress()}
          onEnhancePress={toggleEnhance}
          onSubmit={() => void handleSave()}
          onStartChat={() => void handleStartChat()}
        />
      }
    />
  );
}

// ─── Chat mode ────────────────────────────────────────────────────────────────

interface ChatComposerContentProps {
  chatId: string;
  seedMessage?: string;
  testID?: string;
}

function ChatComposerContent({ chatId, seedMessage, testID }: ChatComposerContentProps) {
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;
  const inputRef = useRef<TextInput>(null);

  const { message, setMessage, uploadState, uploadedAttachmentIds, canSubmit, clearDraft } =
    useComposer({
      seedMessage,
      initialDraft: readChatDraft(resolvedChatId),
      onDraftChange: (msg) => writeChatDraft(resolvedChatId, msg),
      onExtraClearDraft: () => clearChatDraft(resolvedChatId),
    });

  const {
    handleVoicePress,
    isBusy: isVoiceBusy,
    isCleaningVoice,
    isRecording,
    error: voiceError,
    clearError: clearVoiceError,
  } = useVoiceComposerInput({ message, setMessage });

  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance();

  const { sendChatMessage, isChatSending } = useSendMessage({ chatId: resolvedChatId });
  const autoUpdateTitle = useAutoUpdateChatTitle(resolvedChatId);

  useEffect(() => {
    if (!voiceError) return;
    Alert.alert(voiceError.title, voiceError.message, [{ text: 'OK', onPress: clearVoiceError }]);
  }, [clearVoiceError, voiceError]);

  const handleSend = useCallback(async () => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    await sendChatMessage({ message: trimmedMessage, fileIds: uploadedAttachmentIds, noteIds: [] });
    await autoUpdateTitle(trimmedMessage);
    clearDraft();
  }, [
    canSubmit,
    isChatSending,
    message,
    uploadedAttachmentIds,
    sendChatMessage,
    autoUpdateTitle,
    clearDraft,
  ]);

  const hasAttachments = uploadState.errors.length > 0 || uploadState.isUploading;

  return (
    <ComposerShell
      testID={testID ?? 'chat-composer'}
      accessory={hasAttachments ? <ComposerAttachmentRow /> : undefined}
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={t.chat.input.messagePlaceholder}
          testID="chat-composer-input"
        />
      }
      inlinePanel={
        isEnhanceOpen ? (
          <InlineEnhanceTray
            instruction={enhanceInstruction}
            onInstructionChange={setEnhanceInstruction}
            onCancel={closeEnhance}
            onConfirm={() => void runEnhance({ text: message, onEnhanced: setMessage })}
            isEnhancing={isEnhancing}
            error={enhanceError}
          />
        ) : undefined
      }
      toolbar={
        <ComposerToolbar
          mode="chat"
          isRecording={isRecording}
          isVoiceBusy={isVoiceBusy}
          isEnhancing={isEnhancing}
          isCleaningVoice={isCleaningVoice}
          canSubmit={canSubmit}
          isSubmitting={isChatSending}
          onVoicePress={() => void handleVoicePress()}
          onEnhancePress={toggleEnhance}
          onSubmit={() => void handleSend()}
        />
      }
    />
  );
}
