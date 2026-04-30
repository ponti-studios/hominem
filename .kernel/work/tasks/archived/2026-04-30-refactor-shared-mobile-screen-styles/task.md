# Refactor shared style token consumption

## Summary

Consolidate shared style tokens so typography, spacing, radii, and sizing values are defined once and reused by components and screens instead of being repeated as raw literals, using compact `sm/md/lg/xl` scales, with CSS-owned presentation on web and theme-owned presentation on mobile.

## Context

This task implements the token-first style-system direction. The mobile app already has a theme layer, but several commonly reused values still live inline inside component styles. The web UI also still has presentation values flowing through JavaScript in places where CSS should be the source of truth. The work should improve consistency without turning the token layer into a dumping ground for one-off sizes or sprawling token ladders.

## Acceptance Criteria

- [ ] The shared token layer exposes the typography, spacing, radii, and sizing values that are reused across the apps, with no more than four steps per shared scale.
- [ ] At least the highest-traffic mobile shared components and screens read those values from the theme instead of repeating raw numbers.
- [ ] At least the highest-traffic web shared components read those values from CSS-backed tokens instead of JavaScript-defined presentation styles.
- [ ] Existing one-off styles remain local unless they clearly belong in the shared token set.

## Plan

1. Identify the reusable values already repeated across the mobile UI and the web presentation values still defined through JavaScript.
2. Add or expand shared tokens for the values that clearly recur, keeping each scale small.
3. Migrate web shared components away from JavaScript-owned presentation values and onto CSS-backed token consumption.
4. Migrate mobile shared components and a small set of representative screens to the same token vocabulary through the theme.
5. Verify the refactor against the current mobile and web UI and keep one-off styling local.

## Inventory

### Web migration targets

1. [packages/platform/ui/src/components/chat/chat-message.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/chat/chat-message.tsx:34)
   `MessageContent` imports `contentWidths` from the token package and applies `maxWidth` through the `style` prop. This should move to CSS-backed width utilities or semantic classes so web width tokens are not resolved in TSX.
2. [packages/platform/ui/src/components/chat/chat-search-modal.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/chat/chat-search-modal.tsx:30)
   The modal shell uses `style={{ maxWidth: 720 }}`. This is static presentation and should become a class or CSS token-backed utility.
3. [packages/platform/ui/src/components/composer/composer-shell.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/composer/composer-shell.tsx:15)
   The shell centers itself with `style={{ marginInline: 'auto' }}`. This should become a reusable layout class or utility rather than inline JS style.
4. [packages/platform/ui/src/components/layout/page.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/layout/page.tsx:46)
   `Page` and `Container` inject `marginInline: 'auto'` through the `style` prop. This belongs in CSS-backed layout primitives.
5. [packages/platform/ui/src/components/layout/center.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/layout/center.tsx:52)
   `Center` also injects `marginInline: 'auto'` through the `style` prop. Same migration as `Page` and `Container`.
6. [packages/platform/ui/src/components/layout/landing-page.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/layout/landing-page.tsx:74)
   The hero and final CTA headings use inline `clamp(...)` font sizes. These should become named CSS typography utilities or component classes so responsive type stays in CSS.
7. [packages/platform/ui/src/components/loading.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/loading.tsx:9)
   The spinner size scale is defined in a JS map and applied through inline width and height. This should move to CSS size variants or token-backed classes.

### Web exclusions

1. [apps/web/app/routes/notes/page.tsx](/Users/charlesponti/Developer/hominem/apps/web/app/routes/notes/page.tsx:271)
   Virtualized list height and row transforms are runtime layout, not design-token debt.
2. [packages/platform/ui/src/components/chat/chat-messages.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/chat/chat-messages.tsx:119)
   Virtualized chat height and translate transforms are runtime layout, not presentation source-of-truth issues.
3. [packages/platform/ui/src/components/progress.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/progress.tsx:20)
   Progress translate is state-driven behavior.
4. [packages/platform/ui/src/components/ai-elements/checkpoint.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/ai-elements/checkpoint.tsx:97)
   Width is driven by progress state.
5. [packages/platform/ui/src/components/ai-elements/audio-player.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/ai-elements/audio-player.tsx:173)
   Width is driven by playback progress.
6. [packages/platform/ui/src/components/composer/voice-dialog.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/composer/voice-dialog.tsx:153)
   Waveform bar height and opacity are live visualization state.
7. [packages/platform/ui/src/components/layout/header.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/layout/header.tsx:152)
   Safe-area padding, scroll-hide transform, and scrollbar compensation are runtime environment behavior. They can be cleaned up later, but they are not token migration blockers.
8. [packages/platform/ui/src/components/sidebar.tsx](/Users/charlesponti/Developer/hominem/packages/platform/ui/src/components/sidebar.tsx:140)
   Sidebar custom properties are wiring for responsive state and shell dimensions. They are not the same problem as static presentation values defined in JS.

### Notes

- `packages/platform/ui/src/styles/globals.css` already carries the main web token source of truth through CSS custom properties and utility classes.
- `packages/platform/ui/src/theme.ts` still exposes token colors to `apps/web/vite.config.ts` for manifest metadata. That is JS configuration, not component presentation, so it should be tracked separately from this migration.
- Storybook-only inline styles were excluded from this inventory.

## Checklist

- [x] Clarify token scope and acceptance criteria
- [x] Implement the core path
- [x] Verify behavior
- [x] Capture decisions and follow-ups

## Linked Knowledge

- None yet

## Journal

- 2026-04-30T18:00:08.542Z: Created task `refactor-shared-mobile-screen-styles`.
- 2026-04-30T18:07:53Z: Rewritten to target token-first reuse in the mobile theme instead of screen-level style blobs.
- 2026-04-30T18:15:33.235Z: Completed checklist item: Clarify token scope and acceptance criteria
- 2026-04-30T18:15:38.307Z: Completed checklist item: Implement the core path
- 2026-04-30T18:15:40.545Z: Completed checklist item: Verify behavior
- 2026-04-30T18:15:45.323Z: Completed checklist item: Capture decisions and follow-ups
- 2026-04-30T18:16:00Z: Confirmed the shared spacing and size scales should stay at four steps or fewer.
- 2026-04-30T18:32:00Z: Expanded the task to include migrating web shared components from JavaScript-defined presentation values to CSS-backed token consumption.
- 2026-04-30T18:40:00Z: Inventoried the current web JavaScript style usage and separated static presentation migration targets from runtime-behavior exclusions.
- 2026-04-30T18:50:00Z: Migrated the shared web layout primitives off inline `marginInline` styles, moved `chat-message` content widths to CSS utilities, and removed inline `maxWidth`/`clamp(...)` presentation values from `chat-search-modal`, `composer-shell`, `page`, `center`, `page-container`, and `landing-page`.
- 2026-04-30T18:58:00Z: Collapsed the loading/loading-spinner scale to `sm/md/lg/xl`, moved the actual dimensions into CSS utilities, and updated the web app loading wrapper to consume the same CSS-backed scale.
- 2026-04-30T19:06:00Z: Replaced the header mobile tab bar safe-area padding inline style with the shared `pb-safe-area-inset-bottom` utility.
- 2026-04-30T19:12:00Z: Fixed `AuthScaffold` to require a title plus optional muted helper text, updated the web auth routes to use `AUTH_COPY.*.title` for the heading, and refreshed the scaffold stories to match the new contract.
- 2026-04-30T19:18:00Z: Converted the shared search input and loading-state spinners to the CSS-backed loading size utilities, removing the last hard-coded spinner sizes from the shared web surface.
- 2026-04-30T19:24:00Z: Replaced the `SearchInput` ad hoc spinner markup with the shared `LoadingSpinner` component so spinner styling stays centralized.
- 2026-04-30T19:30:00Z: Tightened `LoadingSpinner` to a `variant`-only API and removed `className` so the shared spinner fully owns its own styling.
- 2026-04-30T20:34:24Z: Removed remaining `className` props from the shared AI prompt input wrappers, the chat message layout helpers, and the story preview shells; shared UI typecheck passes again.
- 2026-04-30T21:30:32.919Z: Archived task
