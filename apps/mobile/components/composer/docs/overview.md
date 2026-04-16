# Composer: Overview

The Composer is a floating input bar that lets users create notes, send chat messages, and attach media across every screen in the app.

## What it is

A single `<Composer />` instance is mounted once at the top of the tab layout, positioned absolutely so it floats above all tab screen content simultaneously. It is not embedded in any individual screen.

```
app/(protected)/(tabs)/_layout.tsx
  └─ ComposerProvider
       ├─ Stack (all tab screens)
       └─ Composer  ← floats above everything
```

## What it does

- Accepts typed text input with auto-growing height
- Supports image attachments via the photo library or camera
- Supports voice input with live transcription
- Supports note mentions via `#slug` syntax (chat target only)
- Routes its submit action to either `sendChatMessage` or `createNote` depending on the current screen
- Publishes its own rendered height to context so screens can pad their content to avoid being obscured

## Surfaces

The composer adapts its behavior, placeholder text, and available buttons to the current route:

| Route | Target kind | Primary action | Secondary action |
|---|---|---|---|
| `/feed` | `feed` | Save note | Start chat |
| `/notes` | `notes` | Save note | — |
| `/chat/:id` | `chat` | Send | — |
| `/notes/:id` | `hidden` | — | — |
| `/settings` | `hidden` | — | — |

When the target is `hidden`, the composer is not rendered at all.

## Files

| File | Responsibility |
|---|---|
| `Composer.tsx` | Root component, layout, sub-components |
| `ComposerContext.tsx` | React context, per-target draft state |
| `composerState.ts` | Types, target resolution, presentation derivation |
| `composerActions.ts` | Pure action helpers, `canSubmit`, title building |
| `note-mentions.ts` | Regex helpers for `#mention` detection |
| `useComposerSubmission.ts` | Submit, secondary action, remove attachment |
| `useComposerMediaActions.ts` | Pick attachment, camera capture, voice transcript |
