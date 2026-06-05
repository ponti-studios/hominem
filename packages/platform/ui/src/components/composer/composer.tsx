'use client';

import { CHAT_TITLE_MAX_LENGTH } from '@hominem/rpc/types';
import type { Note } from '@hominem/rpc/types/notes.types';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ChangeEvent } from 'react';
import { memo, useActionState, useRef } from 'react';

import { InlineEnhanceTray } from '../enhance/inline-enhance-tray';
import { AttachedNotesList } from './attached-notes-list';
import { appendChatAttachmentContext, appendNoteAttachments } from './attachment-formatting';
import { ComposerActionsRow } from './composer-actions-row';
import { ComposerAttachmentList } from './composer-attachment-list';
import type { ComposerPresentation } from './composer-presentation';
import { deriveComposerPresentation } from './composer-presentation';
import type {
  ComposerMode,
  ComposerProviderProps,
} from './composer-provider';
import {
  ComposerProvider,
  useComposerActionsRef,
  useComposerSlice,
  useComposerStore,
} from './composer-provider';
import { ComposerShell } from './composer-shell';
import { ComposerTools } from './composer-tools';
import { NotePickerDialog } from './note-picker-dialog';
import { VoiceDialog } from './voice-dialog';

interface TranscribeResult {
  text: string;
}
interface TranscribeVariables {
  audioBlob: Blob;
  language?: string;
}

function buildNoteContext(attachedNotes: ReadonlyArray<Note>): string {
  if (attachedNotes.length === 0) return '';
  const sections = attachedNotes.map(
    (note) => `### ${note.title ?? 'Untitled note'}\n\n${note.content}`,
  );
  return `<context>\n${sections.join('\n\n---\n\n')}\n</context>\n\n`;
}

function toNoteTitle(text: string, fallback = ''): string {
  return text.slice(0, CHAT_TITLE_MAX_LENGTH) || fallback;
}

export interface ComposerProps {
  actionsRef: ComposerProviderProps['actionsRef'];
  buildChatPath: (chatId: string) => string;
  mode: ComposerMode;
  noteId?: string | null;
  chatId?: string | null;
  /** Derived from useNote(noteId) in the layout — no useEffect push needed */
  noteTitle?: string | null;
  store: ComposerProviderProps['store'];
  inlineVoiceEnabled?: boolean;
  transcribeMutation: UseMutationResult<TranscribeResult, Error, TranscribeVariables>;
  /** Notes for the picker — fetched in layout, passed as stable prop */
  notes?: Note[];
}

export function Composer({ actionsRef, store, ...props }: ComposerProps) {
  const presentation = deriveComposerPresentation(props.mode);
  if (presentation.posture === 'hidden') return null;
  return (
    <ComposerProvider store={store} actionsRef={actionsRef}>
      <ComposerForm {...props} presentation={presentation} />
    </ComposerProvider>
  );
}

type ComposerFormProps = Omit<ComposerProps, 'actionsRef' | 'store'> & {
  presentation: ComposerPresentation;
};

const ComposerForm = memo(function ComposerForm({
  buildChatPath,
  noteId,
  chatId,
  noteTitle,
  inlineVoiceEnabled = true,
  transcribeMutation,
  notes = [],
  presentation,
}: ComposerFormProps) {
  const store = useComposerStore();
  const actionsRef = useComposerActionsRef();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const voiceDialogRef = useRef<HTMLDialogElement>(null);
  const notePickerDialogRef = useRef<HTMLDialogElement>(null);

  const [, formAction, isPending] = useActionState(async (_prevState: null, formData: FormData) => {
    const text = ((formData.get('draft') as string) ?? '').trim();
    const intent = formData.get('intent') as string;
    const fNoteId = (formData.get('noteId') as string) || null;
    const fChatId = (formData.get('chatId') as string) || null;
    const fNoteTitle = (formData.get('noteTitle') as string) || null;

    const { attachedNotes, uploadedFiles } = store.getSnapshot();
    const hasContent = text.length > 0 || uploadedFiles.length > 0;
    if (!hasContent) return null;

    const actions = actionsRef.current;

    switch (intent) {
      case 'send-reply': {
        if (!fChatId) break;
        const prefix = buildNoteContext(attachedNotes);
        const message = appendChatAttachmentContext(prefix ? `${prefix}${text}` : text, [
          ...uploadedFiles,
        ]);
        await actions.sendMessage({ chatId: fChatId, message });
        store.dispatch({ type: 'CLEAR' });
        break;
      }
      case 'update-note': {
        if (!fNoteId) break;
        await actions.updateNote({
          id: fNoteId,
          content: appendNoteAttachments(text, [...uploadedFiles]),
        });
        store.dispatch({ type: 'CLEAR_DRAFT' });
        store.dispatch({ type: 'CLEAR_FILES' });
        break;
      }
      case 'save-note':
      case 'save-as-note': {
        await actions.createNote({
          content: appendNoteAttachments(text, [...uploadedFiles]),
        });
        store.dispatch({ type: 'CLEAR_DRAFT' });
        store.dispatch({ type: 'CLEAR_FILES' });
        break;
      }
      case 'start-chat': {
        const seedText = fNoteTitle ? `[Regarding note: "${fNoteTitle}"]\n\n${text}` : text;
        const title = toNoteTitle(text, fNoteTitle ? 'Note chat' : 'New session');
        const chat = await actions.createChat({
          seedText: appendChatAttachmentContext(seedText, [...uploadedFiles]),
          title,
        });
        store.dispatch({ type: 'CLEAR_DRAFT' });
        store.dispatch({ type: 'CLEAR_FILES' });
        actions.navigate(buildChatPath(chat.id));
        break;
      }
    }

    return null;
  }, null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    store.dispatch({ type: 'SET_UPLOADING', isUploading: true });
    try {
      const uploaded = await actionsRef.current.uploadFiles(files);
      store.dispatch({ type: 'ADD_FILES', files: uploaded });
    } catch (err) {
      store.dispatch({
        type: 'SET_UPLOAD_ERRORS',
        errors: [err instanceof Error ? err.message : 'Upload failed'],
      });
    } finally {
      store.dispatch({ type: 'SET_UPLOADING', isUploading: false });
      e.target.value = '';
      inputRef.current?.focus();
    }
  }

  const isDraftMode = presentation.posture === 'draft';
  const showsVoiceButton = inlineVoiceEnabled && presentation.showsVoiceButton;

  return (
    <>
      <input
        ref={fileInputRef}
        data-testid="composer-file-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        data-testid="composer-camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <ComposerShell>
        <form action={formAction} className="flex flex-col gap-1.5">
          <input type="hidden" name="noteId" value={noteId ?? ''} />
          <input type="hidden" name="chatId" value={chatId ?? ''} />
          <input type="hidden" name="noteTitle" value={noteTitle ?? ''} />

          <div className="flex flex-col gap-1">
            <div className="flex flex-col gap-1">
              <ComposerAttachmentList />
              <AttachedNotesList />
              <ComposerInput
                ref={inputRef}
                placeholder={presentation.placeholder}
                isDraftMode={isDraftMode}
                isPending={isPending}
              />
              <ComposerEnhanceTray />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 rounded-full border border-border-subtle bg-background/70 px-1.5 py-1.5">
            <ComposerTools
              fileInputRef={fileInputRef}
              cameraInputRef={cameraInputRef}
              notePickerDialogRef={notePickerDialogRef}
              presentation={presentation}
            />
            <ComposerActionsRow
              presentation={presentation}
              isPending={isPending}
              voiceDialogRef={voiceDialogRef}
              showsVoiceButton={showsVoiceButton}
            />
          </div>
        </form>
      </ComposerShell>

      <VoiceDialog
        ref={voiceDialogRef}
        store={store}
        transcribeMutation={transcribeMutation}
        inputRef={inputRef}
      />
      <NotePickerDialog ref={notePickerDialogRef} notes={notes} inputRef={inputRef} />
    </>
  );
});

const ComposerEnhanceTray = memo(function ComposerEnhanceTray() {
  const store = useComposerStore();
  const actionsRef = useComposerActionsRef();
  const draft = useComposerSlice((s) => s.draft);
  const instruction = useComposerSlice((s) => s.enhanceInstruction);
  const isOpen = useComposerSlice((s) => s.isEnhanceOpen);
  const isEnhancing = useComposerSlice((s) => s.isEnhancing);
  const error = useComposerSlice((s) => s.enhanceError);

  if (!isOpen) {
    return null;
  }

  async function handleConfirm() {
    if (!draft.trim() || isEnhancing) {
      return;
    }

    store.dispatch({ type: 'SET_ENHANCING', isEnhancing: true });
    store.dispatch({ type: 'SET_ENHANCE_ERROR', error: null });

    try {
      const enhanced = await actionsRef.current.enhanceText({
        text: draft,
        instruction: instruction.trim() || undefined,
      });
      store.dispatch({ type: 'SET_DRAFT', text: enhanced });
      store.dispatch({ type: 'RESET_ENHANCE' });
    } catch (caughtError) {
      store.dispatch({
        type: 'SET_ENHANCE_ERROR',
        error: caughtError instanceof Error ? caughtError.message : 'Enhancement failed',
      });
      store.dispatch({ type: 'SET_ENHANCING', isEnhancing: false });
    }
  }

  return (
    <InlineEnhanceTray
      instruction={instruction}
      onInstructionChange={(value) =>
        store.dispatch({ type: 'SET_ENHANCE_INSTRUCTION', instruction: value })
      }
      onCancel={() => store.dispatch({ type: 'RESET_ENHANCE' })}
      onConfirm={() => void handleConfirm()}
      isEnhancing={isEnhancing}
      error={error}
      className="mt-2"
    />
  );
});

const ComposerInput = memo(function ComposerInput({
  ref,
  placeholder,
  isDraftMode,
  isPending,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  isDraftMode: boolean;
  isPending: boolean;
}) {
  const store = useComposerStore();
  const draft = useComposerSlice((s) => s.draft);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      const submitBtn = ref.current?.form?.querySelector('[data-testid="composer-primary"]');
      if (submitBtn && submitBtn instanceof HTMLButtonElement) {
        submitBtn.click();
      }
    }
  }

  return (
    <textarea
      ref={ref}
      name="draft"
      rows={1}
      data-testid="composer-input"
      value={draft}
      onChange={(e) => store.dispatch({ type: 'SET_DRAFT', text: e.target.value })}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={isPending}
      aria-label="Compose message or note"
      className={[
        'body-1 w-full resize-none border-0 bg-transparent p-0 text-text-primary outline-none field-sizing-content overflow-y-auto placeholder:text-text-tertiary focus-visible:outline-none',
        isDraftMode ? 'min-h-14 max-h-40' : 'min-h-12 max-h-32',
      ].join(' ')}
    />
  );
});
