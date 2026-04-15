## 1. Move Hooks to hooks/ Directory

- [x] 1.1 Move `useResumableSessions` from `components/chat/session-card.tsx` to `hooks/useResumableSessions.ts`
- [x] 1.2 Move `useArchivedSessions` from `components/chat/session-card.tsx` to `hooks/useArchivedSessions.ts`
- [x] 1.3 Update imports in `services/inbox/use-inbox-stream-items.ts`
- [x] 1.4 Update imports in `app/(protected)/(tabs)/settings/archived-chats.tsx`

## 2. Rename Component Files to PascalCase

### animated/ directory
- [x] 2.1 Rename `fade-in.tsx` to `FadeIn.tsx` (keep export as `FadeIn`)
- [x] 2.2 Rename `skeleton.tsx` to `Skeleton.tsx` (already PascalCase, verify export)

### error-boundary/ directory
- [x] 2.3 Rename `error-message.tsx` to `ErrorMessage.tsx`
- [x] 2.4 Rename `feature-error-boundary.tsx` to `FeatureErrorBoundary.tsx`
- [x] 2.5 Rename `full-screen-error-fallback.tsx` to `FullScreenErrorFallback.tsx`
- [x] 2.6 Rename `root-error-boundary.tsx` to `RootErrorBoundary.tsx`
- [x] 2.7 Rename `contracts.ts` to `messages.ts`

### chat/ directory
- [x] 2.8 Rename `session-card.tsx` to `InboxItem.tsx` (update export to `InboxItem`)
- [x] 2.9 Move `InboxStreamItemData` type to `inbox-item.types.ts`

### workspace/ directory
- [x] 2.10 Rename `inbox-stream-item.tsx` to `InboxStreamItem.tsx`
- [x] 2.11 Rename `inbox-stream.tsx` to `InboxStream.tsx`
- [x] 2.12 Rename `inbox-stream-items.ts` to `InboxStreamItem.types.ts`

### media/voice/ directory
- [x] 2.13 Rename `VoiceInput.tsx` to `VoiceInput.tsx` (already correct)
- [x] 2.14 Rename `VoicePlayback.tsx` to `VoiceResponse.tsx` (update export)
- [x] 2.15 Rename `use-playback.ts` to `useResponse.ts` (update export)
- [x] 2.16 Rename `use-recorder.ts` to `useInput.ts` (update export)
- [x] 2.17 Rename `audio-meterings.tsx` to `Meter.tsx` (update export to `AudioMeter`)

## 3. Remove "Mobile" Prefix from Types and Components

### input/ directory (rename to composer/ later)
- [x] 3.1 Rename `MobileComposer` to `Composer` in `mobile-composer.tsx`
- [x] 3.2 Rename `MobileComposerMode` to `ComposerMode` in `composer-state.ts`
- [x] 3.3 Rename `MobileComposerAttachment` to `ComposerAttachment` in `composer-state.ts`
- [x] 3.4 Rename `MobileComposerPresentation` to `ComposerPresentation` in `composer-state.ts`

### Rename FeedbackBlock and LoadingState
- [x] 3.5 Rename `FeedbackBlock` export to `Alert` in `feedback-block.tsx`
- [x] 3.6 Rename `LoadingState` export to `Loading` in `loading-state.tsx`
- [x] 3.7 Rename `AuthShell` export to `AuthLayout` in `auth-shell.tsx`
- [x] 3.8 Rename `Container` to `Screen` in `Container.tsx` (or remove if unused)

## 4. Update Input Context and Provider Names

- [x] 4.1 Rename `InputProvider` to `ComposerProvider` in `input-context.tsx`
- [x] 4.2 Rename `useInputContext` to `useComposerContext` in `input-context.tsx`
- [x] 4.3 Rename file `input-context.tsx` to `composer-context.tsx`

## 5. Rename Directories

- [x] 5.1 Rename `input/` directory to `composer/`

## 6. Update All Import Paths

- [x] 6.1 Run `pnpm --filter @hominem/mobile run typecheck` to find broken imports
- [x] 6.2 Update imports in `app/_layout.tsx` (if any)
- [x] 6.3 Update imports in all `app/(protected)/**` screens
- [x] 6.4 Update imports in `services/**` files
- [x] 6.5 Update imports in `hooks/**` files

## 7. Verify and Test

- [x] 7.1 Run `pnpm --filter @hominem/mobile run typecheck` - must pass with 0 errors
- [x] 7.2 Run `pnpm --filter @hominem/mobile run lint` - must pass with 0 errors
- [x] 7.3 Run `pnpm exec expo run:ios` - app must build successfully
- [x] 7.4 Verify auth flow works (login/logout)
- [x] 7.5 Verify composer works (text and voice)
- [ ] 7.6 Verify chat list and navigation
