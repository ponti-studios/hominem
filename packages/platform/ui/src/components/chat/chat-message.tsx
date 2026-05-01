import { formatMessageTimestamp } from '@hominem/chat';
import type { ChatMessageToolCall } from '@hominem/rpc/types/chat.types';
import {
  AlertCircle,
  Check,
  Copy,
  Edit2,
  MoreVertical,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { copyToClipboard } from '../../lib/clipboard';
import { playEnterRow, reducedMotion } from '../../lib/gsap/sequences';
import { useMessageEdit } from '../../lib/hooks/use-message-edit';
import { cn } from '../../lib/utils';
import type { ExtendedMessage } from '../../types/chat';
import { Button } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Form } from '../form';
import { Inline } from '../layout/inline';
import { Stack } from '../layout/stack';
import { Textarea } from '../textarea';
import { MarkdownContent } from './markdown-content';
import { Reasoning } from './reasoning';
import { Tool, ToolInput } from './tool';

function Message({
  from,
  children,
  ...props
}: {
  from: 'user' | 'assistant' | 'system';
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>) {
  const isUser = from === 'user';
  const isSystem = from === 'system';

  return (
    <div
      data-role={from}
      className={cn(
        'flex w-full py-2',
        isSystem ? 'justify-center' : isUser ? 'justify-end' : 'justify-start',
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function MessageContent({
  children,
  align = 'start',
  width = 'transcript',
  style,
  ...props
}: {
  children: ReactNode;
  align?: 'start' | 'end' | 'center';
  width?: 'transcript' | 'bubble' | 'full';
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3',
        align === 'end' && 'items-end text-right',
        align === 'center' && 'items-center text-center',
        width !== 'full' && 'w-full',
        width === 'bubble' && 'content-width-bubble',
        width === 'transcript' && 'content-width-transcript',
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

function MessageAnnotations({
  align = 'start',
  children,
  ...props
}: {
  align?: 'start' | 'end';
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className'>) {
  return (
    <div
      className={cn(
        'mt-2 flex flex-wrap gap-1 body-4 text-text-tertiary/70 opacity-0 transition-opacity group-hover:opacity-100',
        align === 'end' ? 'justify-end' : 'justify-start',
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ChatMessageProps {
  message: ExtendedMessage;
  showDebug?: boolean;
  isStreaming?: boolean;
  speakingId?: string | null;
  speechLoadingId?: string | null;
  onRegenerate?: (() => void) | undefined;
  onEdit?: ((messageId: string, newContent: string) => void) | undefined;
  onDelete?: (() => void) | undefined;
  onSpeak?: ((messageId: string, content: string) => void) | undefined;
}

function MessageToolCalls({ toolCalls }: { toolCalls: ChatMessageToolCall[] | null | undefined }) {
  if (!toolCalls?.length) {
    return null;
  }

  return (
    <Stack gap="sm" className="w-full">
      {toolCalls.map((toolCall: ChatMessageToolCall, index: number) => (
        <Tool
          key={toolCall.toolCallId || `tool-${index}`}
          name={toolCall.toolName}
          status={toolCall.type === 'tool-call' ? 'running' : 'completed'}
        >
          <ToolInput
            className="my-1 overflow-x-auto bg-transparent text-xs text-text-secondary"
            children={
              toolCall.args && Object.keys(toolCall.args).length > 0
                ? JSON.stringify(toolCall.args, null, 2)
                : ''
            }
          />
        </Tool>
      ))}
    </Stack>
  );
}

function MessageErrorNotice() {
  return (
    <div className="flex items-center gap-2 py-0.5 text-sm text-destructive/60">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <span>Failed to generate a response</span>
    </div>
  );
}

function MessageEditForm({
  editContent,
  setEditContent,
  cancelEdit,
  saveEdit,
  canSave,
}: {
  editContent: string;
  setEditContent: (content: string) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  canSave: boolean;
}) {
  return (
    <Form
      className="flex w-full flex-col gap-3"
      aria-label="Edit message"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void saveEdit();
      }}
    >
      <Textarea
        value={editContent}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEditContent(event.target.value)}
        className="min-h-25 resize-none rounded-md border-default bg-background"
        autoFocus
        aria-label="Message content"
        aria-describedby="edit-instructions"
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Escape') {
            cancelEdit();
          } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            void saveEdit();
          }
        }}
      />
      <span id="edit-instructions" className="sr-only">
        Press Escape to cancel, or Ctrl+Enter to save
      </span>
      <Inline gap="sm" justify="end">
        <Button variant="outline" size="sm" onClick={cancelEdit} aria-label="Cancel editing">
          <X className="mr-2 size-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSave} aria-label="Save edited message">
          <Save className="mr-2 size-4" aria-hidden="true" />
          Save
        </Button>
      </Inline>
    </Form>
  );
}

function MessageBody({
  isUser,
  isErrorMessage,
  isEditing,
  hasContent,
  message,
  isStreaming,
  editContent,
  setEditContent,
  cancelEdit,
  saveEdit,
  canSave,
}: {
  isUser: boolean;
  isErrorMessage: boolean;
  isEditing: boolean;
  hasContent: boolean;
  message: ExtendedMessage;
  isStreaming: boolean;
  editContent: string;
  setEditContent: (content: string) => void;
  cancelEdit: () => void;
  saveEdit: () => Promise<void>;
  canSave: boolean;
}) {
  if (isErrorMessage) {
    return <MessageErrorNotice />;
  }

  if (isEditing && isUser) {
    return (
      <MessageEditForm
        editContent={editContent}
        setEditContent={setEditContent}
        cancelEdit={cancelEdit}
        saveEdit={saveEdit}
        canSave={canSave}
      />
    );
  }

  if (!hasContent) {
    return null;
  }

  if (isUser) {
    return (
      <div className="body-3 inline-block max-w-136 rounded-2xl border border-border-default bg-elevated px-4 py-2 text-foreground">
        <MarkdownContent content={message.content} isStreaming={isStreaming} />
      </div>
    );
  }

  return (
    <div className="w-full text-foreground">
      <MarkdownContent content={message.content} isStreaming={isStreaming} />
    </div>
  );
}

function MessageDebugDetails({
  message,
  isStreaming,
  hasReasoning,
}: {
  message: ExtendedMessage;
  isStreaming: boolean;
  hasReasoning: boolean;
}) {
  return (
    <div className="w-full rounded-md border border-subtle bg-surface py-2 font-mono text-[11px] leading-relaxed text-text-secondary">
      <div>ID: {message.id}</div>
      <div>Role: {message.role}</div>
      <div>Created: {message.createdAt}</div>
      <div>Updated: {message.updatedAt}</div>
      <div>Streaming: {isStreaming ? 'true' : 'false'}</div>
      <div>Reasoning: {hasReasoning ? 'present' : 'none'}</div>
      <div>Tool calls: {message.toolCalls?.length ?? 0}</div>
      {message.parentMessageId && <div>Parent: {message.parentMessageId}</div>}
    </div>
  );
}

function MessageTimestamp({
  isUser,
  timestamp,
  createdAt,
}: {
  isUser: boolean;
  timestamp: string;
  createdAt?: string | null;
}) {
  if (!timestamp) {
    return null;
  }

  return (
    <MessageAnnotations align={isUser ? 'end' : 'start'}>
      <span title={createdAt ?? undefined}>{timestamp}</span>
    </MessageAnnotations>
  );
}

function MessageActions({
  isUser,
  message,
  copied,
  isSpeaking,
  isSpeechLoading,
  onEdit,
  onRegenerate,
  onDelete,
  onSpeak,
  startEdit,
  handleCopyMessage,
  handleShareMessage,
}: {
  isUser: boolean;
  message: ExtendedMessage;
  copied: boolean;
  isSpeaking: boolean;
  isSpeechLoading: boolean;
  onEdit?: ((messageId: string, newContent: string) => void) | undefined;
  onRegenerate?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
  onSpeak?: ((messageId: string, content: string) => void) | undefined;
  startEdit: () => void;
  handleCopyMessage: () => Promise<void>;
  handleShareMessage: () => Promise<void>;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
        {
          'justify-end': isUser,
          'justify-start': !isUser,
        },
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-text-tertiary hover:text-foreground"
            aria-label="Message actions"
          >
            <MoreVertical className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={isUser ? 'end' : 'start'}>
          <DropdownMenuItem onClick={handleCopyMessage}>
            {copied ? (
              <>
                <Check className="mr-2 size-3.5" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 size-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </DropdownMenuItem>
          {isUser && onEdit && (
            <DropdownMenuItem onClick={startEdit}>
              <Edit2 className="mr-2 size-3.5" aria-hidden="true" />
              Edit
            </DropdownMenuItem>
          )}
          {!isUser && onRegenerate && (
            <DropdownMenuItem onClick={onRegenerate}>
              <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
              Regenerate
            </DropdownMenuItem>
          )}
          {!isUser && onSpeak && (
            <DropdownMenuItem onClick={() => onSpeak(message.id, message.content || '')}>
              {isSpeechLoading ? (
                <>
                  <Volume2 className="mr-2 size-3.5 animate-pulse" aria-hidden="true" />
                  Loading audio
                </>
              ) : isSpeaking ? (
                <>
                  <VolumeX className="mr-2 size-3.5" aria-hidden="true" />
                  Stop reading
                </>
              ) : (
                <>
                  <Volume2 className="mr-2 size-3.5" aria-hidden="true" />
                  Read aloud
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleShareMessage}>
            <Share2 className="mr-2 size-3.5" aria-hidden="true" />
            Share
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 size-3.5" aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  showDebug = false,
  isStreaming = false,
  speakingId,
  speechLoadingId,
  onRegenerate,
  onEdit,
  onDelete,
  onSpeak,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const hasContent = Boolean(message.content && message.content.trim().length > 0);
  const hasReasoning = Boolean(message.reasoning && message.reasoning.trim().length > 0);
  const isErrorMessage = !isUser && message.content?.startsWith('[Error:');
  const [copied, setCopied] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rowRef.current) return;
    if (reducedMotion()) return;
    playEnterRow(rowRef.current, 0);
  }, []);

  const handleCopyMessage = async () => {
    const success = await copyToClipboard(message.content || '');
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareMessage = async () => {
    const text = message.content;
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ text }).catch(() => null);
    } else {
      const success = await copyToClipboard(text);
      if (success) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const isSpeaking = speakingId === message.id;
  const isSpeechLoading = speechLoadingId === message.id;

  const { isEditing, editContent, setEditContent, startEdit, cancelEdit, saveEdit, canSave } =
    useMessageEdit({
      initialContent: message.content || '',
      ...(onEdit && { onSave: (newContent) => onEdit(message.id, newContent) }),
    });

  const timestamp = message.createdAt ? formatMessageTimestamp(message.createdAt) : '';

  return (
    <div
      ref={rowRef}
      className="group py-2"
      role="article"
      aria-label={`${isUser ? 'Your' : 'Message'}${timestamp ? ` from ${timestamp}` : ''}`}
    >
      <Message from={isUser ? 'user' : 'assistant'}>
        <MessageContent align={isUser ? 'end' : 'start'} width={isUser ? 'bubble' : 'transcript'}>
          {!isUser && hasReasoning && (
            <Reasoning className="border-l-2 border-default py-1 pl-4 my-2 text-text-tertiary">
              {message.reasoning}
            </Reasoning>
          )}

          <MessageToolCalls toolCalls={message.toolCalls} />

          <MessageBody
            isUser={isUser}
            isErrorMessage={isErrorMessage}
            isEditing={isEditing}
            hasContent={hasContent}
            message={message}
            isStreaming={isStreaming}
            editContent={editContent}
            setEditContent={setEditContent}
            cancelEdit={cancelEdit}
            saveEdit={saveEdit}
            canSave={canSave}
          />

          {showDebug && (
            <MessageDebugDetails
              message={message}
              isStreaming={isStreaming}
              hasReasoning={hasReasoning}
            />
          )}

          <MessageTimestamp isUser={isUser} timestamp={timestamp} createdAt={message.createdAt} />

          {!isStreaming && (
            <MessageActions
              isUser={isUser}
              message={message}
              copied={copied}
              isSpeaking={isSpeaking}
              isSpeechLoading={isSpeechLoading}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
              onSpeak={onSpeak}
              startEdit={startEdit}
              handleCopyMessage={handleCopyMessage}
              handleShareMessage={handleShareMessage}
            />
          )}
        </MessageContent>
      </Message>
    </div>
  );
});
