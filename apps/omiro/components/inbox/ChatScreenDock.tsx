import type { ChatMessageItem } from '@hominem/chat';
import type { ReactNode } from 'react';
import Animated from 'react-native-reanimated';

import { ChatGenerationFailedBar, ChatSearchBar, ChatToolApprovalBar } from '~/components/chat';
import { Composer } from '~/components/composer/Composer';
import { ComposerDock } from '~/components/composer/ComposerDock';
import type { useChatSearch } from '~/hooks/use-chat-search';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import type { useSendMessage } from '~/services/chat/use-send-message';
import { nativeMotionAnimations } from '~/services/motion/native-motion';

type PendingToolCall = {
  messageId: string;
  toolCall: NonNullable<ChatMessageItem['toolCalls']>[number];
};

// One keyed slot per dock surface, so a swap crossfades instead of cutting: the
// outgoing surface fades out where it stood while the incoming one fades in.
// Every surface rests at the same height (see BAR_HEIGHT), so the list above
// does not shift.
function DockSlot({ children, slot }: { children: ReactNode; slot: string }) {
  return (
    <Animated.View
      entering={nativeMotionAnimations.fadeInQuick}
      exiting={nativeMotionAnimations.fadeOutQuick}
      key={slot}
    >
      {children}
    </Animated.View>
  );
}

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
      <ComposerDock inFlow restingInset={restingInset} testID="chat-composer-dock">
        {pendingToolCall ? (
          <DockSlot slot="tool-approval">
            <ChatToolApprovalBar
              disabled={isRespondingToToolCall}
              onApprove={() => onRespondToToolCall(true)}
              onReject={() => onRespondToToolCall(false)}
              toolName={pendingToolCall.toolCall.toolName}
            />
          </DockSlot>
        ) : generation?.stage === 'failed' ? (
          <DockSlot slot="failed">
            <ChatGenerationFailedBar
              onEdit={failedMessageText ? onEditFailedMessage : undefined}
              onRetry={onRetryGeneration}
            />
          </DockSlot>
        ) : search.showSearch ? (
          <DockSlot slot="search">
            <ChatSearchBar
              inputRef={search.searchInputRef}
              onChangeQuery={search.handleSearchQueryChange}
              onClose={search.handleCloseSearch}
              query={search.searchQuery}
              resultCount={search.displayMessages.length}
              isSearching={search.isSearching}
            />
          </DockSlot>
        ) : (
          <DockSlot slot="composer">
            <Composer
              mode="chat"
              chatId={chatId}
              chatSend={chatSend}
              generation={
                generation
                  ? {
                      isStopping:
                        generation.stage === 'stopping' || generation.stage === 'cancelled',
                      onCancel: onCancelGeneration,
                    }
                  : undefined
              }
            />
          </DockSlot>
        )}
      </ComposerDock>
    </>
  );
}
