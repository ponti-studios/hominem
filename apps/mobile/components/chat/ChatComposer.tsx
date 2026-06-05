import React, { useCallback, useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { InlineEnhanceTray } from '~/components/ai/InlineEnhanceTray';
import { ComposerAccessories } from '~/components/composer/ComposerAccessories';
import { ComposerActionGroup } from '~/components/composer/ComposerActionGroup';
import { ActionButton } from '~/components/composer/ComposerButtons';
import { ComposerProvider, useComposerAttachments } from '~/components/composer/ComposerContext';
import { ComposerMedia } from '~/components/composer/ComposerMedia';
import { ComposerSurface } from '~/components/composer/ComposerSurface';
import { ComposerTextInput } from '~/components/composer/ComposerTextInput';
import { useChatMentions } from '~/components/composer/useChatMentions';
import { useComposer } from '~/components/composer/useComposer';
import { useInlineEnhance } from '~/services/ai';
import { useActiveChat, useAutoUpdateChatTitle, useSendMessage } from '~/services/chat';
import { clearChatDraft, readChatDraft, writeChatDraft } from '~/services/workspace/launch-state';
import t from '~/translations';

interface ChatComposerProps {
  chatId: string;
  initialMessage?: string;
}

export function ChatComposer({ chatId, initialMessage }: ChatComposerProps) {
  return (
    <ComposerProvider seedMessage={initialMessage}>
      <ChatComposerContent chatId={chatId} />
    </ComposerProvider>
  );
}

function ChatComposerContent({ chatId }: { chatId: string }) {
  const { data: activeChat } = useActiveChat(chatId);
  const resolvedChatId = activeChat?.id ?? chatId;

  const inputRef = useRef<TextInput>(null);

  const {
    message,
    setMessage,
    uploadState,
    uploadedAttachmentIds,
    canSubmit: baseCanSubmit,
    clearDraft,
  } = useComposer({
    initialDraft: readChatDraft(resolvedChatId),
    onDraftChange: (nextMessage) => writeChatDraft(resolvedChatId, nextMessage),
    onExtraClearDraft: () => clearChatDraft(resolvedChatId),
  });
  const { attachments } = useComposerAttachments();
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

  const {
    selectedNotes,
    mentionSuggestions,
    handleSelectMention,
    handleRemoveNote,
    clearSelectedNotes,
  } = useChatMentions({ message, setMessage, inputRef });

  const canSubmit = baseCanSubmit || selectedNotes.length > 0;

  const handleSend = useCallback(async () => {
    if (!canSubmit || isChatSending) return;
    const trimmedMessage = message.trim();
    await sendChatMessage({
      message: trimmedMessage,
      fileIds: uploadedAttachmentIds,
      noteIds: selectedNotes.map((n) => n.id),
    });
    await autoUpdateTitle(trimmedMessage);
    clearDraft();
    clearSelectedNotes();
  }, [
    canSubmit,
    isChatSending,
    message,
    selectedNotes,
    uploadedAttachmentIds,
    sendChatMessage,
    autoUpdateTitle,
    clearDraft,
    clearSelectedNotes,
  ]);

  const hasAccessory =
    attachments.length > 0 ||
    uploadState.errors.length > 0 ||
    uploadState.isUploading ||
    selectedNotes.length > 0 ||
    mentionSuggestions.length > 0;
  const hasContent = message.trim().length > 0;

  return (
    <ComposerSurface
      testID="chat-input"
      accessory={
        hasAccessory ? (
          <ComposerAccessories
            selectedNotes={selectedNotes}
            onRemoveNote={handleRemoveNote}
            mentionSuggestions={mentionSuggestions}
            onSelectMention={handleSelectMention}
          />
        ) : undefined
      }
      input={
        <ComposerTextInput
          inputRef={inputRef}
          value={message}
          onChangeText={setMessage}
          placeholder={t.chat.input.messagePlaceholder}
          testID="chat-input-field"
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
      leadingAction={
        <ComposerMedia
          accessibilityLabel={t.chat.input.addAttachmentA11y}
          disabled={isChatSending}
        />
      }
      actions={
        <ComposerActionGroup hasContent={hasContent}>
          <ActionButton
            icon="wand.and.sparkles"
            onPress={toggleEnhance}
            accessibilityLabel={t.chat.input.enhanceTextA11y}
            disabled={!hasContent || isChatSending || isEnhancing}
            isAnimating={isEnhancing}
          />
          <ActionButton
            icon="arrow.up"
            onPress={() => void handleSend()}
            disabled={!canSubmit || isChatSending}
            accessibilityLabel={
              isChatSending ? t.chat.input.sendingA11y : t.chat.input.sendMessageA11y
            }
          />
        </ComposerActionGroup>
      }
    />
  );
}
