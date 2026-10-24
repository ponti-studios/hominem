import type { ChatMessageItem } from '@hominem/chat';

import { countRender } from '~/services/perf/stream-perf';

import { ChatMessage } from './chat-message';

export function ChatMessageListRow({
  message,
  wasInitialized,
  previousMessage,
  isActive,
  showDebug,
  onActivate,
  onRequestEdit,
  onRegenerate,
  onDelete,
  onRetry,
  formatTimestamp,
}: {
  message: ChatMessageItem;
  wasInitialized: boolean;
  previousMessage?: ChatMessageItem;
  isActive: boolean;
  showDebug: boolean;
  onActivate: (messageId: string) => void;
  onRequestEdit?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  formatTimestamp: (value: string) => string;
}) {
  countRender('ChatMessageListRow');
  const isStreaming = Boolean(message.isStreaming);
  // The list seeds seen IDs from loaded history; FlashList row mount timing is
  // not the same as a message's lifetime because it recycles rows while scrolling.
  const isNewMessage = wasInitialized && !previousMessage;
  // Only a live failure transition gets an entrance animation; old failures
  // stay static when history is loaded or a row is recycled into view.
  const isNewlyFailed =
    wasInitialized &&
    Boolean(message.failed || message.error) &&
    !(previousMessage?.failed || previousMessage?.error);

  return (
    <ChatMessage
      formatTimestamp={formatTimestamp}
      entrance={isNewMessage ? 'new-message' : 'none'}
      failure={isNewlyFailed ? 'new' : 'none'}
      activity={isActive && !isStreaming ? 'active' : 'idle'}
      message={message}
      onActivate={isStreaming ? undefined : onActivate}
      onRequestEdit={isStreaming ? undefined : onRequestEdit}
      onRegenerate={isStreaming ? undefined : onRegenerate}
      onDelete={isStreaming ? undefined : onDelete}
      onRetry={onRetry}
      showDebug={showDebug}
    />
  );
}
