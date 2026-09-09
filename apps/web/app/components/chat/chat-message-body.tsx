import { AnimatePresence, m } from 'motion/react';

import { ChatMessageToolCall } from '~/components/chat/chat-message-tool-call';
import { MessageResponse } from '~/components/chat/message';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '~/components/chat/reasoning';
import { Shimmer } from '~/components/chat/shimmer';
import type { ChatMessageView } from '~/lib/types/chat';
import { cn } from '~/lib/utils';

export function ChatMessageBody({
  draft,
  editError,
  isEditing,
  isNewMessage,
  isRegenerationActive,
  isToolResponding,
  message,
  onApproveTool,
  onDraftChange,
  onRejectTool,
  reduceMotion,
}: {
  draft: string;
  editError: string | null;
  isEditing: boolean;
  isNewMessage: boolean;
  isRegenerationActive: boolean;
  isToolResponding: boolean;
  message: ChatMessageView;
  onApproveTool?: (input: { messageId: string; toolCallId: string }) => void;
  onDraftChange: (value: string) => void;
  onRejectTool?: (input: { messageId: string; toolCallId: string }) => void;
  reduceMotion: boolean;
}) {
  const hasReasoning = Boolean(message.reasoning?.trim());

  return (
    <AnimatePresence initial={isNewMessage} mode="wait">
      {isRegenerationActive ? (
        <m.div
          animate={{ opacity: 1, transform: reduceMotion ? 'none' : 'translateY(0px)' }}
          className="min-h-6"
          exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(-4px)' }}
          initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(4px)' }}
          key="regeneration-thinking"
          transition={{
            duration: reduceMotion ? 0.08 : 0.18,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          <Shimmer duration={1}>Thinking</Shimmer>
        </m.div>
      ) : (
        <m.div
          animate={{ opacity: 1, transform: reduceMotion ? 'none' : 'translateY(0px)' }}
          initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(4px)' }}
          key={`message-content-${message.id}`}
          transition={{
            duration: reduceMotion ? 0.08 : 0.18,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          {hasReasoning ? (
            <Reasoning defaultOpen={false} isStreaming={Boolean(message.isStreaming)}>
              <ReasoningTrigger aria-label="Toggle reasoning" />
              <ReasoningContent>{message.reasoning ?? ''}</ReasoningContent>
            </Reasoning>
          ) : null}
          {message.toolCalls?.map((toolCall) => (
            <ChatMessageToolCall
              key={toolCall.toolCallId}
              isToolResponding={isToolResponding}
              messageId={message.id}
              onApprove={onApproveTool}
              onReject={onRejectTool}
              toolCall={toolCall}
            />
          ))}
          {isEditing ? (
            <div className="flex min-w-72 flex-col gap-2">
              <textarea
                aria-label="Edit message"
                autoFocus
                className="min-h-20 rounded-md border border-border bg-background p-2 text-sm"
                onChange={(event) => onDraftChange(event.target.value)}
                value={draft}
              />
              {editError ? <p className="text-xs text-destructive">{editError}</p> : null}
            </div>
          ) : (
            <>
              {message.isStreaming ? (
                <p
                  aria-label="Response is streaming"
                  className="text-sm text-muted-foreground"
                  role="status"
                >
                  <Shimmer as="span" duration={1}>
                    Thinking
                  </Shimmer>
                </p>
              ) : null}
              <MessageResponse
                className={cn(
                  'font-assistant',
                  message.role === 'assistant' && 'text-[1.05rem] leading-8',
                )}
              >
                {message.content}
              </MessageResponse>
            </>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
