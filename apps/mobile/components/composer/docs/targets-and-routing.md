# Composer: Targets and Routing

The composer adapts its behavior to the current route by resolving a `ComposerTarget` from the active pathname and URL params.

## ComposerTarget shape

```ts
interface ComposerTarget {
  kind: 'feed' | 'notes' | 'chat' | 'hidden';
  key: string;       // stable draft map key
  chatId: string | null;
  noteId: string | null;
}
```

## resolveComposerTarget

`composerState.ts` exports `resolveComposerTarget(pathname, params)`. It is a pure function called inside `ComposerContext` via `useMemo` whenever `pathname`, `params.chatId`, or `params.id` changes.

### Resolution rules

```
pathname includes '/settings'       → kind: 'hidden', key: 'hidden'
pathname includes '/chat/'          → kind: 'chat',   key: 'chat:<chatId>'
pathname includes '/notes/'         → kind: 'hidden', key: 'hidden'
pathname ends with '/notes'         → kind: 'notes',  key: 'notes'
anything else                       → kind: 'feed',   key: 'feed'
```

Chat ID is resolved from, in order:
1. `params.chatId`
2. `params.id`
3. Path segment after `/chat/` extracted with `getPathSegment()`

If a chat route is matched but no chat ID can be resolved, the kind falls back to `hidden`.

### Example outcomes

| Pathname | Params | Result |
|---|---|---|
| `/(tabs)/feed` | `{}` | `{ kind: 'feed', key: 'feed' }` |
| `/(tabs)/notes` | `{}` | `{ kind: 'notes', key: 'notes' }` |
| `/(tabs)/chat/abc123` | `{ chatId: 'abc123' }` | `{ kind: 'chat', key: 'chat:abc123', chatId: 'abc123' }` |
| `/(tabs)/notes/abc123` | `{ id: 'abc123' }` | `{ kind: 'hidden', key: 'hidden' }` |
| `/(tabs)/settings` | `{}` | `{ kind: 'hidden', key: 'hidden' }` |

## deriveComposerPresentation

After `resolveComposerTarget`, `Composer.tsx` calls `deriveComposerPresentation(target, hasContent, isRecording)` to compute what to render.

```ts
interface ComposerPresentation {
  placeholder: string;
  primaryActionLabel: string;
  secondaryActionLabel: string | null;
  showsAttachmentButton: boolean;
  showsVoiceButton: boolean;
  showsNoteChips: boolean;
  isCompact: boolean;
  isHidden: boolean;
}
```

### Presentation by target kind

| Field | `feed` | `notes` | `chat` | `hidden` |
|---|---|---|---|---|
| placeholder (idle) | `'Write a note, ask something, or drop a file'` | `'Write into your notes…'` | `'Message'` | `''` |
| placeholder (recording) | `'Listening…'` | `'Listening…'` | `'Listening…'` | `''` |
| primaryActionLabel | `'Save note'` | `'Save note'` | `'Send'` | `''` |
| secondaryActionLabel | `'Start chat'` | `null` | `null` | `null` |
| showsAttachmentButton | `true` | `true` | `true` | `false` |
| showsVoiceButton | `true` | `true` | `true` | `false` |
| showsNoteChips | `false` | `false` | `true` | `false` |
| isHidden | `false` | `false` | `false` | `true` |

When `isHidden` is `true`, `Composer.tsx` returns `null` immediately and resets `composerClearance` to `0`.

## ComposerContext wiring

```ts
// ComposerContext.tsx
const pathname = usePathname();
const params = useLocalSearchParams<{ chatId?: string | string[]; id?: string | string[] }>();

const target = useMemo(
  () => resolveComposerTarget(pathname, params),
  [pathname, params.chatId, params.id],
);
```

The `params` object reference from Expo Router is unstable (new object on every render), so only the specific fields `params.chatId` and `params.id` are listed as dependencies.
