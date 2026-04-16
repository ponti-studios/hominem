# Composer: State Management

State is split across three layers with distinct responsibilities.

## Layer 1: ComposerContext

`ComposerContext.tsx` is the central store. It holds all draft state keyed by the current target and exposes it to any component in the tree.

### `ComposerContextValue`

```ts
type ComposerContextValue = {
  // Current resolved route target
  target: ComposerTarget;

  // Active draft fields (delegated to activeDraft)
  message: string;
  setMessage: (value: string) => void;
  attachments: ComposerAttachment[];
  setAttachments: (value | updater) => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  mode: ComposerMode;
  setMode: (value: ComposerMode) => void;
  selectedNotes: ComposerSelectedNote[];
  setSelectedNotes: (value | updater) => void;
  addSelectedNote: (note: ComposerSelectedNote) => void;
  removeSelectedNote: (noteId: string) => void;
  clearDraft: () => void;

  // Layout clearance (published by Composer, consumed by screens)
  composerClearance: number;
  setComposerClearance: (value: number) => void;
};
```

### Draft keying

Drafts are stored in a `Record<string, ComposerDraft>` map keyed by `target.key`:

```ts
const [drafts, setDrafts] = useState<Record<string, ComposerDraft>>({
  feed: createEmptyComposerDraft(),
});

const activeDraft = drafts[target.key] ?? createEmptyComposerDraft();
```

Navigating between screens does not clear drafts. Each target (`feed`, `notes`, `chat:abc123`) retains its own draft in memory independently.

### `updateDraft`

All setters go through a single `updateDraft` helper that applies an updater function to the current draft for `target.key`:

```ts
const updateDraft = (updater: (draft: ComposerDraft) => ComposerDraft) => {
  setDrafts((currentDrafts) => ({
    ...currentDrafts,
    [target.key]: updater(currentDrafts[target.key] ?? createEmptyComposerDraft()),
  }));
};
```

This prevents stale-key bugs when `target.key` changes mid-update.

---

## Layer 2: Derived presentation state

`composerState.ts` contains two pure functions that derive display instructions from the current target and draft state. Neither function has side effects.

### `deriveComposerPresentation`

Takes `(target, hasContent, isRecording)` and returns a `ComposerPresentation`:

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

Called on every render inside `Composer.tsx`. The result drives which buttons are visible, what placeholder the input shows, and whether the component renders at all (`isHidden`).

### `resolveComposerTarget`

Takes `(pathname, params)` and returns a `ComposerTarget`. See [targets-and-routing.md](./targets-and-routing.md).

---

## Layer 3: Local component state

`Composer.tsx` holds a small amount of local state that controls modal visibility — state that doesn't need to be shared:

```ts
const [isVoiceOpen, setIsVoiceOpen] = useState(false);   // known bug: always false
const [isCameraOpen, setIsCameraOpen] = useState(false);
const voiceModalRef = useRef<BottomSheetModal>(null);
```

It also owns two animated values:

```ts
const animatedH = useSharedValue(INPUT_MIN_H);  // input height spring
const keyboard = useAnimatedKeyboard();          // from react-native-keyboard-controller
```

---

## State ownership summary

| State | Owner | Notes |
|---|---|---|
| `text` | ComposerContext draft | Per target key |
| `attachments` | ComposerContext draft | Per target key |
| `isRecording` | ComposerContext draft | Ephemeral, should not be in draft |
| `mode` | ComposerContext draft | `'text'` or `'voice'` |
| `selectedNotes` | ComposerContext draft | Per target key |
| `composerClearance` | ComposerContext | Shared to screens |
| `target` | ComposerContext | Derived from route |
| `isCameraOpen` | Local component state | Modal gate |
| `isVoiceOpen` | Local component state | Unused (bug) |
| `animatedH` | Local shared value | Input height |
| Recording state machine | `audio.service.ts` singleton | External pub/sub store |
| Upload state | `useFileUpload` hook | Local to media actions |
