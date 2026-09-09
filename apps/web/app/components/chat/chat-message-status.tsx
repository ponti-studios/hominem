import type { ChatMessageView } from '~/lib/types/chat';

const messageTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatMessageTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : messageTimestampFormatter.format(date);
};

export function ChatMessageStatus({
  formatTimestamp,
  hasReasoning,
  message,
  regenerationError,
  onRetryRegenerate,
  showDebug,
}: {
  formatTimestamp: (value: string) => string;
  hasReasoning: boolean;
  message: ChatMessageView;
  regenerationError?: string | null;
  onRetryRegenerate?: () => void;
  showDebug: boolean;
}) {
  return (
    <>
      {message.failed ? (
        <p aria-live="polite" className="text-xs text-destructive" role="alert">
          {message.role === 'assistant'
            ? 'Response interrupted. The previous content is preserved.'
            : `${message.error || 'Message failed to send.'} Retry when ready.`}
        </p>
      ) : null}
      {regenerationError ? (
        <p aria-live="polite" className="text-xs text-destructive" role="alert">
          {regenerationError}
          {onRetryRegenerate ? (
            <button className="ml-1 underline" onClick={onRetryRegenerate} type="button">
              Retry
            </button>
          ) : null}
        </p>
      ) : null}
      {showDebug && !message.isStreaming ? (
        <details className="rounded-md border border-border p-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Debug details</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono">
            <dt>ID</dt>
            <dd>{message.id}</dd>
            <dt>Role</dt>
            <dd>{message.role}</dd>
            <dt>Created</dt>
            <dd>{formatTimestamp(message.createdAt)}</dd>
            <dt>Reasoning</dt>
            <dd>{hasReasoning ? 'present' : 'none'}</dd>
            <dt>Tool calls</dt>
            <dd>{message.toolCalls?.length ?? 0}</dd>
          </dl>
        </details>
      ) : null}
    </>
  );
}
