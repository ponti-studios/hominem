import type { ChatMessageDto } from '@hominem/rpc/types/chat.types';
import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import { memo } from 'react';

import { ChatMessageActions } from '~/components/chat/chat-message-actions';
import { ChatMessageBody } from '~/components/chat/chat-message-body';
import { ChatMessageStatus, formatMessageTimestamp } from '~/components/chat/chat-message-status';
import { Message, MessageContent } from '~/components/chat/message';
import { useChatMessageEdit } from '~/components/chat/use-chat-message-edit';
import type { RegenerationStatus } from '~/lib/hooks/use-regenerate-message';
import type { ChatMessageView } from '~/lib/types/chat';
import { cn } from '~/lib/utils';

function toMessageRole(role: ChatMessageDto['role']): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant';
}

export interface ChatMessageProps {
  message: ChatMessageView;
  showDebug?: boolean;
  formatTimestamp?: (value: string) => string;
  speechSrc?: string;
  isSpeechActive?: boolean;
  shouldAutoSpeak?: boolean;
  isToolResponding?: boolean;
  isRegenerating?: boolean;
  regenerationStatus?: RegenerationStatus;
  isGenerationActive?: boolean;
  isNewMessage?: boolean;
  isFocused?: boolean;
  regenerationError?: string | null;
  onActivateSpeech?: (messageId: string) => void;
  onApproveTool?: (input: { messageId: string; toolCallId: string }) => void;
  onDeactivateSpeech?: (messageId: string) => void;
  onRejectTool?: (input: { messageId: string; toolCallId: string }) => void;
  onRegenerate?: (messageId: string) => void;
  onCancelRegenerate?: () => void;
  onRetryRegenerate?: () => void;
  onEdit?: (messageId: string, content: string) => Promise<void> | void;
  onDelete?: (messageId: string) => Promise<void>;
  onFocusMessage?: (messageId: string) => void;
  onBlurMessage?: (messageId: string) => void;
  isDeleting?: boolean;
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showDebug = false,
  formatTimestamp = formatMessageTimestamp,
  speechSrc,
  isSpeechActive = false,
  shouldAutoSpeak = false,
  isToolResponding = false,
  isRegenerating = false,
  regenerationStatus = 'idle',
  isGenerationActive = false,
  isNewMessage = false,
  isFocused = false,
  regenerationError,
  onActivateSpeech,
  onApproveTool,
  onDeactivateSpeech,
  onRejectTool,
  onRegenerate,
  onCancelRegenerate,
  onRetryRegenerate,
  onEdit,
  onDelete,
  onFocusMessage,
  onBlurMessage,
  isDeleting = false,
}: ChatMessageProps) {
  const reduceMotion = useReducedMotion() === true;
  const edit = useChatMessageEdit({ content: message.content, messageId: message.id, onEdit });
  const isRegenerationActive =
    isRegenerating ||
    regenerationStatus === 'preparing' ||
    regenerationStatus === 'streaming' ||
    regenerationStatus === 'stopping';
  const isRegenerationStopping = regenerationStatus === 'stopping';
  const hasReasoning = Boolean(message.reasoning?.trim());
  const presentationState = message.failed
    ? message.role === 'assistant'
      ? 'interrupted'
      : 'failed'
    : message.isStreaming
      ? 'streaming'
      : 'complete';

  return (
    <LazyMotion features={domAnimation}>
      <Message
        aria-label={`Message ${presentationState}`}
        className={cn(
          'justify-start! outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring/40',
          message.role === 'user' ? 'mt-3' : 'mt-0',
        )}
        data-chat-message
        data-focused={isFocused ? 'true' : 'false'}
        data-presentation-state={presentationState}
        from={toMessageRole(message.role)}
        onBlur={(event) => {
          const relatedTarget = event.relatedTarget;
          if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
            onBlurMessage?.(message.id);
          }
        }}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('button')) return;
          onFocusMessage?.(message.id);
        }}
        onFocus={() => onFocusMessage?.(message.id)}
        tabIndex={0}
      >
        <MessageContent
          className={cn('ml-0! w-full!', isFocused && 'border-ring/35 bg-card ring-1 ring-ring/25')}
        >
          <ChatMessageBody
            draft={edit.draft}
            editError={edit.error}
            isEditing={edit.isEditing}
            isNewMessage={isNewMessage}
            isRegenerationActive={isRegenerationActive}
            isToolResponding={isToolResponding}
            message={message}
            onApproveTool={onApproveTool}
            onDraftChange={edit.setDraft}
            onRejectTool={onRejectTool}
            reduceMotion={reduceMotion}
          />
          <ChatMessageStatus
            formatTimestamp={formatTimestamp}
            hasReasoning={hasReasoning}
            message={message}
            onRetryRegenerate={onRetryRegenerate}
            regenerationError={regenerationError}
            showDebug={showDebug}
          />
          <ChatMessageActions
            edit={edit}
            isDeleting={isDeleting}
            isFocused={isFocused}
            isGenerationActive={isGenerationActive}
            isRegenerationActive={isRegenerationActive}
            isRegenerationStopping={isRegenerationStopping}
            isSpeechActive={isSpeechActive}
            isToolResponding={isToolResponding}
            message={message}
            onActivateSpeech={onActivateSpeech}
            onCancelRegenerate={onCancelRegenerate}
            onDeactivateSpeech={onDeactivateSpeech}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            reduceMotion={reduceMotion}
            shouldAutoSpeak={shouldAutoSpeak}
            speechSrc={speechSrc}
          />
        </MessageContent>
      </Message>
    </LazyMotion>
  );
});
