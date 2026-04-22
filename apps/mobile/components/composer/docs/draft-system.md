# Composer: Draft System

Each composer target (feed, notes, chat) maintains an independent in-memory draft that persists as the user navigates between screens.

## ComposerDraft shape

```ts
interface ComposerDraft {
  text: string;
  attachments: ComposerAttachment[];
  isRecording: boolean;
  mode: ComposerMode; // 'text' | 'voice'
  selectedNotes: ComposerSelectedNote[];
}
```

`createEmptyComposerDraft()` returns a zeroed instance of this shape.

## Per-target keying

Drafts are stored in a `Record<string, ComposerDraft>` map inside `ComposerContext`. The key is `target.key`:

| Route          | `target.key`    |
| -------------- | --------------- |
| `/feed`        | `'feed'`        |
| `/notes`       | `'notes'`       |
| `/chat/abc123` | `'chat:abc123'` |
| hidden routes  | `'hidden'`      |

When the user navigates from `/feed` to `/chat/abc123` and back, both drafts are independently preserved in the map. The active draft is simply read by key:

```ts
const activeDraft = drafts[target.key] ?? createEmptyComposerDraft();
```

## Draft lifecycle

| Event                | Effect                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Route change         | `target.key` changes; the map entry for the new key is read (or a blank draft is created) |
| User types           | `updateDraft` writes to `drafts[target.key].text`                                         |
| User adds attachment | `updateDraft` appends to `drafts[target.key].attachments`                                 |
| User submits         | `clearDraft()` resets `drafts[target.key]` to `createEmptyComposerDraft()`                |
| App background/kill  | Drafts are **lost** — they live only in React state                                       |

## Draft persistence (not yet connected)

`apps/mobile/hooks/use-draft-persistence.ts` provides an AsyncStorage-backed draft persistence hook with:

- Debounced save (5 second delay)
- Restore on mount
- Clear on submit

This hook is fully implemented but not imported or used anywhere in the composer system. Drafts are not currently persisted across app kills.

## ComposerAttachment shape

```ts
interface ComposerAttachment {
  id: string; // matches uploadedFile.id once uploaded
  name: string; // display name
  type: string; // 'image', 'video', etc.
  localUri?: string; // local file path for thumbnail
  uploadedFile?: UploadedFile; // populated after upload completes
}
```

Attachments are added optimistically (before upload completes) so the thumbnail renders immediately. The `uploadedFile` field is populated asynchronously as each file uploads.

## ComposerSelectedNote shape

`ComposerSelectedNote` is an alias for `NoteSearchResult`:

```ts
type ComposerSelectedNote = NoteSearchResult;
// { id, title, excerpt, ... }
```

Selected notes are added via mention selection and sent alongside the message. See [mentions.md](./mentions.md).
