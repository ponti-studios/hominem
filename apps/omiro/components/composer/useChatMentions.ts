import type { NoteSearchResult } from '@hominem/rpc/types';
import React, { useCallback, useMemo, useState } from 'react';
import type { TextInput } from 'react-native';

import { useNoteSearch } from '~/services/notes/use-note-search';

import { getTrailingMentionQuery, removeTrailingMentionQuery } from './note-mentions';

interface UseChatMentionsOptions {
  message: string;
  setMessage: (text: string) => void;
  inputRef: React.RefObject<TextInput | null>;
}

export function useChatMentions({ message, setMessage, inputRef }: UseChatMentionsOptions) {
  const [selectedNotes, setSelectedNotes] = useState<NoteSearchResult[]>([]);
  const mentionQuery = useMemo(() => getTrailingMentionQuery(message), [message]);
  const { data: searchResults } = useNoteSearch(mentionQuery ?? '', mentionQuery !== null);

  const mentionSuggestions = useMemo(
    () =>
      (searchResults?.notes ?? []).filter((note) => !selectedNotes.some((s) => s.id === note.id)),
    [searchResults?.notes, selectedNotes],
  );

  const handleSelectMention = useCallback(
    (note: NoteSearchResult) => {
      setMessage(removeTrailingMentionQuery(message));
      setSelectedNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
      inputRef.current?.focus();
    },
    [message, setMessage, inputRef],
  );

  const handleRemoveNote = useCallback(
    (noteId: string) => setSelectedNotes((prev) => prev.filter((n) => n.id !== noteId)),
    [],
  );

  const clearSelectedNotes = useCallback(() => setSelectedNotes([]), []);

  return {
    selectedNotes,
    mentionQuery,
    mentionSuggestions,
    handleSelectMention,
    handleRemoveNote,
    clearSelectedNotes,
  };
}
