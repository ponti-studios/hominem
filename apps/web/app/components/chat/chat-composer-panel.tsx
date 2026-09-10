import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ChatComposer } from '~/components/chat/chat-composer';
import { useChatComposerState } from '~/lib/hooks/use-chat-composer-state';
import { useChatComposerSubmission } from '~/lib/hooks/use-chat-composer-submission';
import type { useChatDisplayMessages } from '~/lib/hooks/use-chat-display-messages';
import type { useRegenerateMessage } from '~/lib/hooks/use-regenerate-message';
import type { useResponseLength } from '~/lib/hooks/use-response-length';
import { getSpeechErrorMessage, useSpeechToText } from '~/lib/hooks/use-speech-to-text';
import type { useStreamMessage } from '~/lib/hooks/use-stream-message';

type SeedNote = { id: string; title?: string | null; excerpt?: string | null };

interface ChatComposerPanelProps {
  chatId: string;
  currentChatTitle?: string;
  display: ReturnType<typeof useChatDisplayMessages>;
  isOnline: boolean;
  onRequestAutoSpeak: (messageId: string) => void;
  regeneration: ReturnType<typeof useRegenerateMessage>;
  responseLength: ReturnType<typeof useResponseLength>['responseLength'];
  seedNote: SeedNote | null;
  streamMessage: ReturnType<typeof useStreamMessage>;
  updateChatTitle: { mutate: (input: { chatId: string; title: string }) => void };
  walkieTalkieMode: boolean;
}

export function ChatComposerPanel({
  chatId,
  currentChatTitle,
  display,
  isOnline,
  onRequestAutoSpeak,
  regeneration,
  responseLength,
  seedNote,
  streamMessage,
  updateChatTitle,
  walkieTalkieMode,
}: ChatComposerPanelProps) {
  const composer = useChatComposerState({ chatId, seedNote });
  const speech = useSpeechToText({ onTranscript: composer.setDraft });
  const submission = useChatComposerSubmission({
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
  });
  const { setPendingAssistantMessage } = display;
  const streamStartedAtRef = useRef<string | null>(null);

  const contextContent = useMemo(
    () =>
      composer.suggestions.length > 0 || composer.selectedNotesForSend.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {composer.selectedNotesForSend.map((note) => (
            <button
              key={note.id}
              type="button"
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              onClick={() => composer.removeSelectedNote(note.id)}
            >
              {note.title || 'Untitled'} ×
            </button>
          ))}
          {composer.suggestions.map((note) => (
            <button
              key={note.id}
              type="button"
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              onClick={() => composer.selectSuggestion(note)}
            >
              {note.title || 'Untitled'}
            </button>
          ))}
        </div>
      ) : null,
    [
      composer.removeSelectedNote,
      composer.selectSuggestion,
      composer.selectedNotesForSend,
      composer.suggestions,
    ],
  );

  const attachFiles = useCallback(
    (files: FileList | null) => void composer.attachFiles(files),
    [composer.attachFiles],
  );
  const stop = useCallback(() => void streamMessage.cancel(), [streamMessage.cancel]);
  const submit = useCallback(() => void submission.submit(), [submission.submit]);
  const toggleVoice = useCallback(
    () => speech.toggle(composer.draft),
    [composer.draft, speech.toggle],
  );
  const retry = useMemo(
    () =>
      composer.uploadState.errors.length > 0 && isOnline
        ? () => void composer.retryFailedUpload()
        : submission.isRetryable && isOnline
          ? submission.retryGeneration
          : undefined,
    [
      composer.retryFailedUpload,
      composer.uploadState.errors.length,
      isOnline,
      submission.isRetryable,
      submission.retryGeneration,
    ],
  );

  useEffect(() => {
    if (
      !streamMessage.isStreaming ||
      (!streamMessage.text && !streamMessage.reasoning && streamMessage.toolSteps.length === 0)
    ) {
      streamStartedAtRef.current = null;
      return;
    }

    streamStartedAtRef.current ??= new Date().toISOString();
    const startedAt = streamStartedAtRef.current;
    setPendingAssistantMessage({
      id: `stream-${chatId}`,
      chatId,
      userId: '',
      role: 'assistant',
      content: streamMessage.text,
      files: null,
      toolCalls: streamMessage.toolSteps.map((step) => ({
        toolName: step.toolName,
        type: 'tool-call' as const,
        toolCallId: step.toolCallId,
        args: {},
        ...(streamMessage.status === 'awaiting_confirmation'
          ? { confirmationStatus: 'pending' as const, executionStatus: 'pending' as const }
          : {}),
      })),
      reasoning: streamMessage.reasoning || null,
      parentMessageId: null,
      createdAt: startedAt,
      updatedAt: startedAt,
      isStreaming: true,
    });
  }, [
    chatId,
    setPendingAssistantMessage,
    streamMessage.isStreaming,
    streamMessage.reasoning,
    streamMessage.text,
    streamMessage.toolSteps,
  ]);

  const error = !isOnline
    ? 'You are offline. Your draft and attachments are preserved.'
    : composer.uploadState.errors.length > 0
      ? composer.uploadState.errors.join(', ')
      : speech.error
        ? getSpeechErrorMessage(speech.error)
        : streamMessage.error?.message;

  return (
    <ChatComposer
      attachments={composer.attachedFiles}
      className="mx-auto w-full max-w-3xl"
      contextContent={contextContent}
      draft={composer.draft}
      error={error}
      statusMessage={
        streamMessage.isRetrying
          ? 'Trying again…'
          : streamMessage.status === 'cancelled'
            ? 'Stopped.'
            : null
      }
      hasContext={composer.selectedNotesForSend.length > 0}
      isOffline={!isOnline}
      isSubmitting={
        streamMessage.isStreaming ||
        streamMessage.status === 'stopping' ||
        regeneration.isRegenerating
      }
      isStreaming={streamMessage.isStreaming}
      isUploading={composer.uploadState.isUploading}
      isVoiceSupported={speech.isSupported}
      isListening={speech.isListening}
      onAttachFiles={attachFiles}
      onChangeDraft={composer.setDraft}
      onRemoveAttachment={composer.removeAttachment}
      onStop={stop}
      onSubmit={submit}
      onRetry={retry}
      onToggleVoice={toggleVoice}
    />
  );
}
