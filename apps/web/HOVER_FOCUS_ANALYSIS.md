# `apps/web` hover and focus analysis

This report summarizes explicit hover/focus styling in `apps/web/app`.

## Scope

Included:

- App-local source in `apps/web/app/**/*`
- App-level stylesheet entrypoint in `apps/web/app/globals.css`

Excluded:

- Shared interaction styles that live in `packages/ui` unless they are overridden locally in `apps/web`
- Default browser behavior

## High-level takeaway

`apps/web` is very light on app-local hover/focus styling. Most interaction styling used by the web app comes from shared components in `@hominem/ui`.

In the app layer itself, explicit hover/focus utilities are concentrated in just two files:

- `apps/web/app/routes/chat.$chatId.tsx`
- `apps/web/app/components/notes/note-editor.tsx`

`apps/web/app/globals.css` only imports shared styles and does not define its own hover/focus rules.

## App-level stylesheet

### `apps/web/app/globals.css`

This file contains only imports:

- `@hominem/ui/src/styles.css`
- `@hominem/ui/src/animations.css`

It also sets the Tailwind source path to `packages/ui/src`.

No app-specific hover/focus rules are defined here.

## Detailed inventory

### Chat route

`apps/web/app/routes/chat.$chatId.tsx`

The only explicit hover styling in this file is on the accordion triggers:

- `hover:bg-muted/40`

Applied to:

- the `Current chat` accordion trigger
- the `Selected notes (...)` accordion trigger

Other interactive elements in this route use shared UI primitives or plain markup without local hover/focus overrides:

- `Button` instances rely on `@hominem/ui/button`
- the file attach `label` uses `cursor-pointer` but no explicit hover/focus utilities
- inline links such as `Back to inbox` and `Archive chat` use plain underline styling, not hover/focus classes

### Note editor

`apps/web/app/components/notes/note-editor.tsx`

This file contains both hover and focus styling.

#### File attachment link

For attached files, the anchor uses:

- `underline-offset-4`
- `hover:underline`

This gives the filename a standard link affordance on hover.

#### Detach file button

The detach button uses:

- `hover:text-foreground`
- `focus-visible:outline-none`
- `focus-visible:[outline-style:solid]`
- `focus-visible:outline-2`
- `focus-visible:outline-ring`

This is the clearest app-local keyboard focus treatment in `apps/web`.

## What relies on shared `@hominem/ui` behavior

Most other interactive elements in `apps/web` depend on shared UI components for their hover/focus states:

- `Button` from `@hominem/ui/button`
- `Accordion` from `@hominem/ui/accordion`
- `DropdownMenu` from `@hominem/ui/dropdown-menu`
- `Card`, `StatePanel`, and other shared primitives

Examples in app code that do not add local hover/focus classes:

- `apps/web/app/routes/home.tsx` uses `buttonVariants(...)` from `@hominem/ui/button`
- `apps/web/app/routes/account.tsx` uses `Button` from `@hominem/ui/button`
- `apps/web/app/routes/$.tsx` uses `Button asChild`
- `apps/web/app/components/error-state.tsx` uses `Button` inside `StatePanel`
- `apps/web/app/components/notes/note-editor.tsx` uses shared `Button`, `DropdownMenu`, and `DropdownMenuItem` for action controls

## Pattern summary

### Hover styles found in app-local code

- `hover:bg-muted/40` on accordion triggers in `chat.$chatId.tsx`
- `hover:underline` on note file links in `note-editor.tsx`
- `hover:text-foreground` on the note detach button in `note-editor.tsx`

### Focus styles found in app-local code

- `focus-visible:outline-none` + `focus-visible:[outline-style:solid]` + `focus-visible:outline-2` + `focus-visible:outline-ring` on the note detach button

### No app-local focus rules

- `apps/web/app/routes/chat.$chatId.tsx` does not add explicit focus utilities to its local hoverable accordion triggers
- `apps/web/app/globals.css` does not define any app-level focus rules

## Notable observations

- `apps/web` is mostly a consumer of the interaction contract defined in `packages/ui`.
- The app layer itself keeps hover/focus overrides minimal.
- The one clearly accessible local pattern is the note file detach button, which includes an explicit keyboard focus ring.

## Best starting points if you want to change app-local interactions

- Chat accordion trigger hover styling: `apps/web/app/routes/chat.$chatId.tsx`
- Note attachment and detach affordances: `apps/web/app/components/notes/note-editor.tsx`
- Shared button/accordion/menu behavior used throughout the app: `packages/ui/src/components/button.tsx`, `packages/ui/src/components/accordion.tsx`, `packages/ui/src/components/dropdown-menu.tsx`
