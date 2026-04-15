# Composer: Note Mentions

## Overview

On a `chat` target, the user can type `#slug` at the end of a message to search for and attach notes to the message. This is only active for the `chat` target kind.

## Trigger detection

`note-mentions.ts` exports two pure functions:

```ts
// Returns the slug after a trailing #, or null if not present
function getTrailingMentionQuery(value: string): string | null {
  const match = /(?:^|\s)#([a-z0-9-]+)$/i.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
}

// Removes the trailing #slug token from the message text
function removeTrailingMentionQuery(value: string): string {
  const match = /(?:^|\s)#[a-z0-9-]+$/i.exec(value);
  if (!match || typeof match.index !== 'number') return value;
  return value.slice(0, match.index).trimEnd();
}
```

### Regex constraints

- The `#` must be at the start of the string or preceded by whitespace (`(?:^|\s)`)
- The slug must be alphanumeric with hyphens only (`[a-z0-9-]+`)
- The slug must be at the **end** of the string (`$`)
- Case-insensitive

Notes with spaces, apostrophes, or other punctuation in their titles cannot be triggered by mention.

## Search query derivation

In `Composer.tsx`, `mentionQuery` is computed on every message change:

```ts
const mentionQuery = useMemo(
  () => (target.kind === 'chat' ? getTrailingMentionQuery(message) : null),
  [message, target.kind],
);
```

`useNoteSearch` is only enabled when there is an active query:

```ts
const { data: searchResults } = useNoteSearch(
  mentionQuery ?? '',
  target.kind === 'chat' && mentionQuery !== null,
);
```

`useNoteSearch` queries `GET /notes/search?query=<slug>&limit=8` with a 30-second stale time.

## Filtering

Already-selected notes are filtered out of the suggestions:

```ts
const mentionSuggestions = useMemo(
  () =>
    (searchResults?.notes ?? []).filter(
      (note) => !selectedNotes.some((selected) => selected.id === note.id),
    ),
  [searchResults?.notes, selectedNotes],
);
```

## MentionSuggestions rendering

The suggestions render as an inline list inside the card, above the text input, using `MentionSuggestions`:

```tsx
<View style={styles.suggestions} testID="mobile-composer-mention-suggestions">
  {suggestions.map((note) => (
    <Pressable key={note.id} onPress={() => onSelect(note)} testID={`mobile-composer-mention-${note.id}`}>
      <Text>{note.title || 'Untitled note'}</Text>
      {note.excerpt ? <Text numberOfLines={1}>{note.excerpt}</Text> : null}
    </Pressable>
  ))}
</View>
```

Pressing a suggestion calls `handleSelectMention`.

## handleSelectMention

```ts
const handleSelectMention = (note: NoteSearchResult) => {
  setMessage(removeTrailingMentionQuery(message));  // strip #slug from text
  addSelectedNote(note);                            // add to selectedNotes
  inputRef.current?.focus();                        // keep keyboard open
};
```

## ComposerSelectionSummary

Selected notes render as chips above the text input. Each chip shows:
- `bubble.left` icon
- Note title (or `'Untitled note'`)
- `xmark` button to remove

Removing a note calls `removeSelectedNote(note.id)` which filters the note out of `activeDraft.selectedNotes`.

## How selected notes are sent

When `handlePrimaryAction` fires for a `chat` target:

```ts
const noteIds = getSelectedNoteIds(selectedNotes);        // string[]
void sendChatMessage({
  message: trimmedMessage,
  ...(noteIds.length > 0 ? { noteIds } : {}),
  ...(selectedNotes.length > 0 ? { referencedNotes: selectedNotes } : {}),
});
```

Both `noteIds` (ID list) and `referencedNotes` (full objects) are sent. The note chips are only shown when `presentation.showsNoteChips` is `true`, which is only the case for the `chat` target.
