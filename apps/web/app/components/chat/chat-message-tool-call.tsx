import type { ChatMessageDto } from '@hominem/rpc/types/chat.types';

import {
  getToolCallStatus,
  Tool,
  ToolApprovalActions,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolPreview,
} from '~/components/chat/tool';

type ChatToolCall = NonNullable<ChatMessageDto['toolCalls']>[number];

export function ChatMessageToolCall({
  messageId,
  toolCall,
  isToolResponding,
  onApprove,
  onReject,
}: {
  messageId: string;
  toolCall: ChatToolCall;
  isToolResponding: boolean;
  onApprove?: (input: { messageId: string; toolCallId: string }) => void;
  onReject?: (input: { messageId: string; toolCallId: string }) => void;
}) {
  const status = getToolCallStatus(toolCall);
  const isPending = toolCall.confirmationStatus === 'pending';

  return (
    <Tool defaultOpen={isPending}>
      <ToolHeader status={status} toolName={toolCall.toolName} />
      <ToolContent>
        {toolCall.preview ? (
          <ToolPreview preview={toolCall.preview} />
        ) : (
          <ToolInput input={toolCall.args} />
        )}
        {isPending && onApprove && onReject ? (
          <ToolApprovalActions
            disabled={isToolResponding}
            onApprove={() => onApprove({ messageId, toolCallId: toolCall.toolCallId })}
            onReject={() => onReject({ messageId, toolCallId: toolCall.toolCallId })}
          />
        ) : null}
      </ToolContent>
    </Tool>
  );
}
