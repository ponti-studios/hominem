import type { ChatMessageItem } from '@hominem/chat';

import { ChatGenerationBar, ChatSearchBar, ChatToolApprovalBar } from '~/components/chat';
import { Composer } from '~/components/composer/Composer';
import { ComposerDock } from '~/components/composer/ComposerDock';
import type { useChatSearch } from '~/hooks/use-chat-search';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import type { useSendMessage } from '~/services/chat/use-send-message';

type PendingToolCall = {
  messageId: string;
  toolCall: NonNullable<ChatMessageItem['toolCalls']>[number];
};

type ChatScreenDockProps = {
  chatId: string;
  restingInset: number;
  isConversationGone: boolean;
  pendingToolCall?: PendingToolCall;
  isRespondingToToolCall: boolean;
  onRespondToToolCall: (approved: boolean) => void;
  generation: ChatGenerationState | null;
  failedMessageText?: string;
  onEditFailedMessage: () => void;
  onCancelGeneration: () => void;
  onRetryGeneration: () => void;
  search: ReturnType<typeof useChatSearch>;
  chatSend: Pick<ReturnType<typeof useSendMessage>, 'sendChatMessage' | 'isChatSending'>;
};

export function ChatScreenDock({
  chatId,
  restingInset,
  isConversationGone,
  pendingToolCall,
  isRespondingToToolCall,
  onRespondToToolCall,
  generation,
  failedMessageText,
  onEditFailedMessage,
  onCancelGeneration,
  onRetryGeneration,
  search,
  chatSend,
}: ChatScreenDockProps) {
  if (isConversationGone) {
    return null;
  }

  return (
    <>
      <ComposerDock restingInset={restingInset} testID="chat-composer-dock">
        {pendingToolCall ? (
          <ChatToolApprovalBar
            disabled={isRespondingToToolCall}
            onApprove={() => onRespondToToolCall(true)}
            onReject={() => onRespondToToolCall(false)}
            toolName={pendingToolCall.toolCall.toolName}
          />
        ) : generation ? (
          <ChatGenerationBar
            generation={generation}
            onCancel={onCancelGeneration}
            onEdit={failedMessageText ? onEditFailedMessage : undefined}
            onRetry={onRetryGeneration}
          />
        ) : search.showSearch ? (
          <ChatSearchBar
            inputRef={search.searchInputRef}
            onChangeQuery={search.handleSearchQueryChange}
            onClose={search.handleCloseSearch}
            query={search.searchQuery}
            resultCount={search.displayMessages.length}
            isSearching={search.isSearching}
          />
        ) : (
          <Composer mode="chat" chatId={chatId} chatSend={chatSend} />
        )}
      </ComposerDock>
    </>
  );
}
