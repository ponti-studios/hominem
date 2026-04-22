# Composer: Architecture

## Mount point

`Composer` is rendered inside `ComposerProvider` at `app/(protected)/(tabs)/_layout.tsx`, as a sibling to the `<Stack>` navigator:

```
ComposerProvider
  └─ TopAnchoredFeedProvider
       ├─ Stack            ← all tab screens render here
       └─ Composer         ← absolute, floats above all tabs
```

This single-instance pattern means one component instance is shared across every tab screen. It reacts to route changes via `usePathname` and `useLocalSearchParams` inside `ComposerContext`.

## Component tree

```
Composer (Composer.tsx)
├─ Animated.View [shell]          absolute positioned, keyboard-aware bottom offset
│   └─ Animated.View [card]       visible card surface, max-width 500px
│       ├─ ComposerAttachments
│       │   └─ ScrollView (horizontal)
│       │       └─ Pressable (per attachment)
│       │           ├─ expo-image Image
│       │           ├─ xmark badge
│       │           └─ dim overlay (while uploading)
│       ├─ ComposerSelectionSummary
│       │   └─ selectionChip (per selected note)
│       │       ├─ bubble.left icon
│       │       ├─ note title
│       │       └─ xmark Pressable
│       ├─ MentionSuggestions
│       │   └─ Pressable (per search result)
│       │       ├─ note title
│       │       └─ excerpt (1 line)
│       ├─ Animated.View [inputSurface]
│       │   └─ TextInput
│       └─ View [accessoryRow]
│           ├─ View [accessoryLeft]
│           │   ├─ SecondaryButton (plus)      — if showsAttachmentButton
│           │   └─ SecondaryButton (waveform)  — if showsVoiceButton
│           └─ View [accessoryRight]
│               ├─ SecondaryButton (bubble.left) — if secondaryActionLabel
│               └─ SendButton (arrow.up)
├─ CameraModal (BottomSheetModal)
│   └─ BottomSheetView
│       └─ Camera (react-native-vision-camera)
│           └─ controls: close / capture / flip
└─ VoiceSessionModal (BottomSheetModal)
    └─ BottomSheetView
        └─ VoiceInput
            ├─ WaveformVisualizer (12 bars)
            └─ controls: mic/stop, duration, pause/resume
```

## Layout constants

```ts
MAX_WIDTH = 500; // card max width
INPUT_MIN_H = spacing[6] + spacing[4]; // ~48px
INPUT_MAX_H = spacing[6] * 9; // ~288px
SEND_BTN_SIZE = spacing[6]; // ~32px
SECONDARY_BTN_SIZE = spacing[5] + 2; // ~26px
```

## Card visual structure (vertical, top to bottom)

1. `ComposerAttachments` — horizontal scroll strip of image thumbnails + error text
2. `ComposerSelectionSummary` — wrapping row of note chips
3. `MentionSuggestions` — inline dropdown inside the card
4. `inputSurface` — the `TextInput`
5. `accessoryRow` — left media buttons / right action buttons

## Shell positioning

The outer `Animated.View` shell is `position: absolute`, spanning `left: 0` to `right: 0` with `paddingHorizontal: spacing[4]`. Its `bottom` is driven by an animated style that tracks keyboard height:

```ts
// Composer.tsx
const shellStyle = useAnimatedStyle(() => ({
  bottom: keyboard.height.value + Math.max(insets.bottom, spacing[2]),
}));
```

See [keyboard-handling.md](./keyboard-handling.md) for full details.

## Data flow summary

```
Route change
  └─ resolveComposerTarget(pathname, params)
       └─ target { kind, key, chatId, noteId }

User types
  └─ setMessage → updateDraft(target.key) → activeDraft.text

User attaches media
  └─ pickAttachment / handleCameraCapture
       └─ uploadAssets → setAttachments → activeDraft.attachments

User records voice
  └─ VoiceSessionModal → VoiceInput → useInput → audio.service
       └─ stopRecording → useTranscriber → handleVoiceTranscript
            └─ setMessage (append transcript)

User selects mention
  └─ #slug → getTrailingMentionQuery → useNoteSearch
       └─ handleSelectMention → removeTrailingMentionQuery + addSelectedNote

User submits
  └─ handlePrimaryAction → resolveComposerPrimaryAction(target.kind)
       └─ sendChatMessage | createNote → clearDraft
```
