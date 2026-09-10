import { useCallback, useEffect, useState } from 'react';

import { getAutomaticChatTitle } from '~/lib/chat/chat-title';

import type { useChatComposerState } from './use-chat-composer-state';
import type { useChatDisplayMessages } from './use-chat-display-messages';
import type { ResponseLength } from './use-response-length';
import type { useSpeechToText } from './use-speech-to-text';
import type { useStreamMessage } from './use-stream-message';

type ComposerState = ReturnType<typeof useChatComposerState>;
type DisplayState = ReturnType<typeof useChatDisplayMessages>;
type SpeechState = ReturnType<typeof useSpeechToText>;
type StreamState = ReturnType<typeof useStreamMessage>;

interface UseChatComposerSubmissionOptions {
  chatId: string;
  currentChatTitle?: string;
  composer: ComposerState;
  display: DisplayState;
  isOnline: boolean;
  onRequestAutoSpeak: (messageId: string) => void;
  responseLength: ResponseLength;
  speech: SpeechState;
  streamMessage: StreamState;
  updateChatTitle: { mutate: (input: { chatId: string; title: string }) => void };
  walkieTalkieMode: boolean;
}

export function useChatComposerSubmission({
  chatId,
  currentChatTitle,
  composer,
  display,
  isOnline,
  onRequestAutoSpeak,
  responseLength,
  speech,
  streamMessage,
  updateChatTitle,
  walkieTalkieMode,
}: UseChatComposerSubmissionOptions) {
  const [isRetryable, setIsRetryable] = useState(false);
  const {
    attachedFiles,
    clear,
    draftWithSeed,
    selectedNotesForSend,
    restore,
    setDraft,
    uploadState,
  } = composer;
  const { isListening, stop } = speech;
  const { isStreaming, retry, status, stream } = streamMessage;
  const { setOptimisticUserMessage, setPendingAssistantMessage } = display;
  const { mutate: updateTitle } = updateChatTitle;

  useEffect(() => {
    if (status === 'failed') setIsRetryable(true);
  }, [status]);

  const retryGeneration = useCallback(() => {
    if (!isOnline) return;
    setIsRetryable(false);
    void retry({
      responseLength,
      onCommitted: (message) => setPendingAssistantMessage(message),
      onFailed: () => setIsRetryable(true),
      onSettled: () => setPendingAssistantMessage(null),
    });
  }, [isOnline, responseLength, retry, setPendingAssistantMessage]);

  const submit = useCallback(async () => {
    if (
      !isOnline ||
      isStreaming ||
      status === 'stopping' ||
      uploadState.isUploading ||
      (draftWithSeed.trim().length === 0 &&
        attachedFiles.length === 0 &&
        selectedNotesForSend.length === 0)
    ) {
      return;
    }

    const shouldAutoSpeak = isListening || walkieTalkieMode;
    if (isListening) stop();

    const messageToSend = draftWithSeed;
    const filesToSend = attachedFiles;
    let accepted = false;
    setIsRetryable(false);

    const now = new Date().toISOString();
    setOptimisticUserMessage({
      id: `optimistic-${crypto.randomUUID()}`,
      chatId,
      userId: '',
      role: 'user',
      content: messageToSend,
      files: null,
      toolCalls: null,
      reasoning: null,
      parentMessageId: null,
      createdAt: now,
      updatedAt: now,
    });
    setPendingAssistantMessage(null);
    clear();

    await stream({
      message: messageToSend,
      fileIds: filesToSend.map((file) => file.id),
      responseLength,
      responseModality: shouldAutoSpeak ? 'audio' : 'text',
      onAccepted: (userMessage) => {
        accepted = true;
        setIsRetryable(false);
        if (userMessage) setOptimisticUserMessage(userMessage);
        const title = getAutomaticChatTitle(userMessage?.content ?? '');
        if (currentChatTitle === 'New chat' && title) {
          updateTitle({ chatId, title });
        }
      },
      onCommitted: (message) => {
        setPendingAssistantMessage(message);
        if (shouldAutoSpeak) onRequestAutoSpeak(message.id);
      },
      onCancelled: () => {
        setDraft(messageToSend);
        if (!accepted) setIsRetryable(true);
      },
      onFailed: () => {
        restore({ attachments: filesToSend, draft: messageToSend });
        if (!accepted) setIsRetryable(true);
      },
    });

    setOptimisticUserMessage(null);
    setPendingAssistantMessage(null);
  }, [
    chatId,
    attachedFiles,
    clear,
    draftWithSeed,
    currentChatTitle,
    isOnline,
    isStreaming,
    isListening,
    onRequestAutoSpeak,
    responseLength,
    restore,
    selectedNotesForSend,
    setDraft,
    setOptimisticUserMessage,
    setPendingAssistantMessage,
    status,
    stop,
    stream,
    updateTitle,
    uploadState.isUploading,
    walkieTalkieMode,
  ]);

  return { isRetryable, retryGeneration, submit };
}
