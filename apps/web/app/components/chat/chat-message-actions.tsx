import { Check, Clipboard, Pencil, RotateCcw, Share2, Trash2, X } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/alert-dialog';
import { MessageAction, MessageActions } from '~/components/chat/message';
import { SpeechPlayer } from '~/components/chat/speech-player';
import type { ChatMessageView } from '~/lib/types/chat';
import { cn } from '~/lib/utils';

type EditState = {
  canEdit: boolean;
  cancelEditing: () => void;
  error: string | null;
  isEditing: boolean;
  save: () => Promise<void>;
  startEditing: () => void;
};

function getRegenerationLabel(isStopping: boolean, isActive: boolean) {
  if (isStopping) return 'Stopping regeneration';
  if (isActive) return 'Stop regenerating response';
  return 'Regenerate response';
}

export function ChatMessageActions({
  edit,
  isDeleting,
  isFocused,
  isGenerationActive,
  isRegenerationActive,
  isRegenerationStopping,
  isSpeechActive,
  isToolResponding,
  message,
  onActivateSpeech,
  onCancelRegenerate,
  onDeactivateSpeech,
  onDelete,
  onRegenerate,
  reduceMotion,
  shouldAutoSpeak,
  speechSrc,
}: {
  edit: EditState;
  isDeleting: boolean;
  isFocused: boolean;
  isGenerationActive: boolean;
  isRegenerationActive: boolean;
  isRegenerationStopping: boolean;
  isSpeechActive: boolean;
  isToolResponding: boolean;
  message: ChatMessageView;
  onActivateSpeech?: (messageId: string) => void;
  onCancelRegenerate?: () => void;
  onDeactivateSpeech?: (messageId: string) => void;
  onDelete?: (messageId: string) => Promise<void>;
  onRegenerate?: (messageId: string) => void;
  reduceMotion: boolean;
  shouldAutoSpeak: boolean;
  speechSrc?: string;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareState, setShareState] = useState<'idle' | 'shared' | 'failed'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const canEdit = edit.canEdit && message.role === 'user' && !message.isStreaming;
  const canDelete = message.role === 'user' && !message.isStreaming && Boolean(onDelete);
  const canSpeak =
    message.role === 'assistant' &&
    message.content.trim().length > 0 &&
    !message.isStreaming &&
    speechSrc &&
    onActivateSpeech &&
    onDeactivateSpeech;
  const hasContent = !message.isStreaming && !isRegenerationActive && message.content.trim();
  const hasActions =
    (canEdit && Boolean(edit.startEditing)) ||
    canDelete ||
    (message.role === 'assistant' && onRegenerate) ||
    hasContent;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  async function shareMessage() {
    try {
      if (navigator.share) {
        await navigator.share({ text: message.content });
      } else {
        const url = URL.createObjectURL(new Blob([message.content], { type: 'text/plain' }));
        const link = document.createElement('a');
        link.download = `message-${message.id}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
      setShareState('shared');
    } catch {
      setShareState('failed');
    }
  }

  async function confirmDelete() {
    if (!onDelete) return;
    try {
      await onDelete(message.id);
      setDeleteError(null);
      setIsDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this message.');
    }
  }

  if (!hasActions) return null;

  const regenerationLabel = getRegenerationLabel(isRegenerationStopping, isRegenerationActive);

  return (
    <MessageActions
      className={cn(
        'justify-start pt-1 text-muted-foreground',
        'invisible opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
        isFocused && 'visible opacity-100',
      )}
    >
      {canSpeak ? (
        <SpeechPlayer
          autoPlay={shouldAutoSpeak}
          isActive={isSpeechActive}
          messageId={message.id}
          onActivate={onActivateSpeech}
          onDeactivate={onDeactivateSpeech}
          src={speechSrc}
        />
      ) : null}
      {hasContent ? (
        <>
          <MessageAction
            label={
              message.role === 'user'
                ? copyState === 'copied'
                  ? 'Copied user message'
                  : copyState === 'failed'
                    ? 'Copy user message failed'
                    : 'Copy user message'
                : copyState === 'copied'
                  ? 'Copied assistant message'
                  : copyState === 'failed'
                    ? 'Copy assistant message failed'
                    : 'Copy assistant message'
            }
            onClick={() => void copyMessage()}
            tooltip={
              copyState === 'copied'
                ? 'Copied'
                : copyState === 'failed'
                  ? 'Copy failed'
                  : 'Copy message'
            }
          >
            <Clipboard aria-hidden="true" size={14} />
          </MessageAction>
          {message.role === 'assistant' ? (
            <MessageAction
              label={
                shareState === 'shared'
                  ? 'Shared assistant message'
                  : shareState === 'failed'
                    ? 'Share assistant message failed'
                    : 'Share assistant message'
              }
              onClick={() => void shareMessage()}
              tooltip={
                shareState === 'shared'
                  ? 'Shared'
                  : shareState === 'failed'
                    ? 'Share failed'
                    : 'Share message'
              }
            >
              <Share2 aria-hidden="true" size={14} />
            </MessageAction>
          ) : null}
        </>
      ) : null}
      {canEdit || canDelete ? (
        <div className="grid">
          <AnimatePresence initial={false}>
            {edit.isEditing ? (
              <m.div
                animate={{ opacity: 1 }}
                className="col-start-1 row-start-1 flex gap-1"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="edit-confirm-actions"
                transition={{ duration: reduceMotion ? 0.08 : 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                <MessageAction
                  label="Save edit"
                  onClick={() => void edit.save()}
                  tooltip="Save edit"
                >
                  <Check aria-hidden="true" size={14} />
                </MessageAction>
                <MessageAction
                  label="Cancel edit"
                  onClick={edit.cancelEditing}
                  tooltip="Cancel edit"
                >
                  <X aria-hidden="true" size={14} />
                </MessageAction>
              </m.div>
            ) : (
              <m.div
                animate={{ opacity: 1 }}
                className="col-start-1 row-start-1 flex gap-1"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="edit-trigger-actions"
                transition={{ duration: reduceMotion ? 0.08 : 0.15, ease: [0.23, 1, 0.32, 1] }}
              >
                {canEdit && !isRegenerationActive && !isGenerationActive ? (
                  <MessageAction
                    label="Edit message"
                    onClick={edit.startEditing}
                    tooltip="Edit message"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </MessageAction>
                ) : null}
                {canDelete ? (
                  <AlertDialog
                    onOpenChange={(open) => {
                      setIsDeleteOpen(open);
                      if (open) setDeleteError(null);
                    }}
                    open={isDeleteOpen}
                  >
                    <AlertDialogTrigger asChild>
                      <MessageAction
                        disabled={isDeleting || isGenerationActive}
                        label="Delete user message"
                        tooltip="Delete message"
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </MessageAction>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete this message and all later messages in the conversation.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={isDeleting}
                          onClick={(event) => {
                            event.preventDefault();
                            void confirmDelete();
                          }}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete message'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      ) : null}
      {message.role === 'assistant' && onRegenerate ? (
        <MessageAction
          disabled={
            isToolResponding ||
            message.isStreaming ||
            (isGenerationActive && !isRegenerationActive) ||
            isRegenerationStopping
          }
          label={regenerationLabel}
          onClick={() => {
            if (isRegenerationActive && !isRegenerationStopping) onCancelRegenerate?.();
            else if (!isRegenerationActive) onRegenerate(message.id);
          }}
          tooltip={regenerationLabel}
        >
          <AnimatePresence initial={false} mode="wait">
            <m.span
              animate={{ opacity: 1, transform: reduceMotion ? 'none' : 'scale(1)' }}
              exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'scale(0.9)' }}
              initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'scale(0.9)' }}
              key={isRegenerationStopping ? 'stopping' : isRegenerationActive ? 'active' : 'idle'}
              transition={{ duration: reduceMotion ? 0.08 : 0.15, ease: [0.23, 1, 0.32, 1] }}
            >
              {isRegenerationStopping ? (
                <span
                  aria-hidden="true"
                  className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                />
              ) : isRegenerationActive ? (
                <X aria-hidden="true" size={14} />
              ) : (
                <RotateCcw aria-hidden="true" size={14} />
              )}
            </m.span>
          </AnimatePresence>
        </MessageAction>
      ) : null}
      {deleteError ? (
        <p aria-live="polite" className="text-xs text-destructive" role="alert">
          {deleteError} Try again when ready.
        </p>
      ) : null}
    </MessageActions>
  );
}
