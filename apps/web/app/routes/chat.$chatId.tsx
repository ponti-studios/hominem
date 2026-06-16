import type { NoteSearchResult } from '@hominem/rpc/types/notes.types';
import { EmptyState, InlineEnhanceTray, useInlineEnhance } from '@hominem/ui';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@hominem/ui/accordion';
import { Button } from '@hominem/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@hominem/ui/command';
import { cn } from '@hominem/ui/lib/utils';
import { slugifyText } from '@hominem/utils/text';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, data } from 'react-router';

import { useTextEnhance } from '~/hooks/ai';
import { useArchiveChat } from '~/hooks/use-chats';
import { useNoteSearch } from '~/hooks/use-notes';
import { createServerApiClient } from '~/lib/api.server';
import { useChatMessages } from '~/lib/hooks/use-chat-messages';
import { useFileUpload } from '~/lib/hooks/use-file-upload';
import { useStreamMessage } from '~/lib/hooks/use-stream-message';

import type { Route } from './+types/chat.$chatId';

type SelectedNote = NoteSearchResult;

type NoteLoaderData = {
  id: string;
  title?: string | null;
  excerpt?: string | null;
};

function getMentionQuery(value: string) {
  const match = value.match(/#([a-z0-9-]*)$/i);
  return match?.[1] ?? '';
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const client = createServerApiClient(request);
    const [chat, messages] = await Promise.all([
      client.api.chats[':id'].$get({ param: { id: params.chatId } }).then((res) => res.json()),
      client.api.chats[':id'].messages
        .$get({ param: { id: params.chatId }, query: { limit: '50' } })
        .then((res) => res.json()),
    ]);

    const noteId = new URL(request.url).searchParams.get('noteId');
    let seedNote: NoteLoaderData | null = null;
    if (noteId) {
      seedNote = await client.api.notes[':id']
        .$get({ param: { id: noteId } })
        .then((res) => res.json())
        .catch(() => null);
    }

    return data({ chat, seedNote, messages });
  } catch {
    return data({ chat: null, seedNote: null, messages: [] });
  }
}

export default function ChatPage({ loaderData, params }: Route.ComponentProps) {
  const { chat, seedNote, messages: initialMessages } = loaderData;
  const { chatId } = params;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { messages } = useChatMessages({ chatId, initialData: initialMessages });
  const streamMessage = useStreamMessage({ chatId });
  const archiveChat = useArchiveChat({ chatId });
  const { uploadFiles, uploadState } = useFileUpload();
  const { enhance } = useTextEnhance();

  const [draft, setDraft] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<
    Array<{ id: string; originalName: string; url: string; textContent?: string; content?: string }>
  >([]);
  const {
    isEnhanceOpen,
    enhanceInstruction,
    setEnhanceInstruction,
    enhanceError,
    isEnhancing,
    toggleEnhance,
    closeEnhance,
    runEnhance,
  } = useInlineEnhance({
    onEnhanceText: ({ text, instruction }) => enhance({ text, instruction }),
  });

  const seededNote = useMemo(
    () => (seedNote ? [{ id: seedNote.id, title: seedNote.title, excerpt: seedNote.excerpt }] : []),
    [seedNote],
  );

  const selectedNotesForSend = useMemo(
    () => [
      ...seededNote,
      ...selectedNotes.filter((note) => !seededNote.some((seed) => seed.id === note.id)),
    ],
    [seededNote, selectedNotes],
  );

  const draftWithSeed = useMemo(() => {
    if (!seedNote) {
      return draft;
    }

    const slug = slugifyText(seedNote.title ?? null);
    if (!slug || draft.includes(`#${slug}`)) {
      return draft;
    }

    return `${draft} #${slug}`.trim();
  }, [draft, seedNote]);

  const mentionQuery = getMentionQuery(draftWithSeed);
  const { data: searchResults } = useNoteSearch(mentionQuery, mentionQuery.length > 0);

  const suggestions = useMemo(
    () =>
      (searchResults?.notes ?? []).filter(
        (note) => !selectedNotesForSend.some((selected) => selected.id === note.id),
      ),
    [searchResults?.notes, selectedNotesForSend],
  );

  const handleSelectSuggestion = useCallback((note: SelectedNote) => {
    setSelectedNotes((current) =>
      current.some((selected) => selected.id === note.id) ? current : [...current, note],
    );
    const mentionSlug = slugifyText(note.title ?? note.id);
    setDraft((current) => current.replace(/#([a-z0-9-]*)$/i, `#${mentionSlug} `));
    inputRef.current?.focus();
  }, []);

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const uploaded = await uploadFiles(fileList);
    if (uploaded.length === 0) {
      return;
    }
    setAttachedFiles((current) => [...current, ...uploaded]);
  }

  async function handleSend() {
    if (!draftWithSeed.trim() && attachedFiles.length === 0 && selectedNotesForSend.length === 0) {
      return;
    }

    await streamMessage.stream({
      message: draftWithSeed,
      fileIds: attachedFiles.map((file) => file.id),
      noteIds: selectedNotesForSend.map((note) => note.id),
    });

    setDraft('');
    setAttachedFiles([]);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside>
        <Accordion type="multiple" defaultValue={['chat', 'notes']} className="space-y-3">
          <AccordionItem value="chat" className="rounded-2xl border-border-subtle bg-surface">
            <AccordionTrigger className="rounded-2xl p-4 text-base">
              Current chat
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-4 pb-4 pt-0">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{chat?.title || 'Chat'}</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Explicitly selected notes and uploaded files are the only extra context sent with
                  each turn.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/inbox" className="text-sm text-text-secondary underline">
                  Back to inbox
                </Link>
                <button
                  type="button"
                  className="text-sm text-text-secondary underline"
                  onClick={() => archiveChat.mutate()}
                >
                  Archive chat
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes" className="rounded-2xl border-border-subtle bg-surface">
            <AccordionTrigger className="rounded-2xl p-4 text-base">
              Selected notes ({selectedNotesForSend.length})
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-0">
              <div className="flex flex-wrap gap-2">
                {selectedNotesForSend.length === 0 ? (
                  <p className="text-sm text-text-secondary">
                    Type <code>#</code> in the composer to search notes.
                  </p>
                ) : null}
                {selectedNotesForSend.map((note) => (
                  <span
                    key={note.id}
                    className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary"
                  >
                    {note.title || 'Untitled note'}
                  </span>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

      <div className="flex min-h-[70vh] flex-col rounded-2xl border border-border-subtle bg-surface">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'rounded-2xl p-4',
                message.role === 'user' ? 'bg-background' : 'bg-muted/30',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary">
                  {message.role}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {message.content}
              </p>
              {message.referencedNotes?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.referencedNotes.map((note) => (
                    <span
                      key={note.id}
                      className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary"
                    >
                      {note.title || note.id}
                    </span>
                  ))}
                </div>
              ) : null}
              {message.files?.length ? (
                <div className="mt-3 space-y-2">
                  {message.files.map((file, index) => (
                    <div
                      key={`${message.id}-${index}`}
                      className="rounded-xl border border-border-subtle p-3 text-xs text-text-secondary"
                    >
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground underline"
                      >
                        {file.filename || 'Attachment'}
                      </a>
                      {file.metadata && 'extractedText' in file.metadata ? (
                        <p className="mt-2 whitespace-pre-wrap">
                          {String(file.metadata.extractedText)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet."
              description={
                <>
                  Ask a question, mention notes with <code>#</code>, or attach a file.
                </>
              }
              variant="dashed"
            />
          ) : null}
        </div>

        <div
          className="border-t border-border-subtle p-4"
          data-upload-state={uploadState.state}
          data-upload-progress={uploadState.progress}
        >
          <div className="space-y-3">
            {mentionQuery.length > 0 ? (
              <Command className="rounded-2xl border border-border-subtle bg-background">
                <CommandList>
                  <CommandEmpty>No matching notes for “{mentionQuery}”.</CommandEmpty>
                  <CommandGroup heading="Matching notes">
                    {suggestions.map((note) => (
                      <CommandItem
                        key={note.id}
                        value={`${note.title ?? ''} ${note.excerpt ?? ''}`.trim()}
                        onSelect={() => handleSelectSuggestion(note)}
                      >
                        <div className="flex flex-col gap-1 py-1">
                          <span className="text-sm font-medium text-foreground">
                            {note.title || 'Untitled note'}
                          </span>
                          {note.excerpt ? (
                            <span className="line-clamp-2 text-xs text-text-secondary">
                              {note.excerpt}
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : null}

            {attachedFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    className="rounded-full border border-border-subtle px-3 py-1 text-xs text-text-secondary"
                    onClick={() =>
                      setAttachedFiles((current) => current.filter((item) => item.id !== file.id))
                    }
                  >
                    {file.originalName} x
                  </button>
                ))}
              </div>
            ) : null}

            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask something, mention a note with #, or paste text from a file."
              className="min-h-[120px] w-full rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none"
            />

            {isEnhanceOpen ? (
              <InlineEnhanceTray
                instruction={enhanceInstruction}
                onInstructionChange={setEnhanceInstruction}
                onCancel={closeEnhance}
                onConfirm={() => void runEnhance({ text: draft, onEnhanced: setDraft })}
                isEnhancing={isEnhancing}
                error={enhanceError}
              />
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-full border border-border-subtle px-4 py-2 text-sm text-text-secondary">
                  Attach files
                  <input
                    hidden
                    multiple
                    type="file"
                    data-testid="chat-file-input"
                    onChange={(event) => {
                      void handleAttachFiles(event.target.files);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {uploadState.errors.length > 0 ? (
                  <span className="text-xs text-destructive">{uploadState.errors.join(', ')}</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!draft.trim() || isEnhancing || streamMessage.isStreaming}
                  onClick={toggleEnhance}
                >
                  Enhance
                </Button>
                <Button
                  type="button"
                  disabled={streamMessage.isStreaming || isEnhancing}
                  onClick={() => void handleSend()}
                >
                  {streamMessage.isStreaming ? 'Streaming...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
