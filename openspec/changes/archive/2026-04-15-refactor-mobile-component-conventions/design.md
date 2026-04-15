## Context

The mobile app's `components/` directory has grown organically, resulting in:

**Naming Issues:**
- `MobileComposer*` prefix on 4 types (noise since all code is mobile)
- Meaningless words: "Block", "Shell", "State", "Container"
- `contracts.ts` for message factories (not TypeScript-canonical)
- Inconsistent file casing: `fade-in.tsx` vs `fade.ts`

**Structural Issues:**
- Hooks embedded in component files (`session-card.tsx` contains `useResumableSessions`, `useArchivedSessions`)
- 467-line `mobile-composer.tsx` monolith
- `input/` directory contains composer-specific code, not generic inputs

**Directory:** `apps/mobile/components/`
**Stakeholders:** Mobile team developers

## Goals / Non-Goals

**Goals:**
- Establish clear naming conventions for components, hooks, types, and files
- Enforce strict separation: presentation components in `components/`, logic in `hooks/`
- Replace meaningless packaging terms with descriptive names
- Use TypeScript-canonical patterns (no "contracts")

**Non-Goals:**
- Not changing any component behavior or functionality
- Not adding new features
- Not refactoring the design system (`@hominem/ui` tokens are out of scope)
- Not restructuring `mobile/services/` or `mobile/hooks/` directories

## Decisions

### Decision 1: Remove "Mobile" Prefix

**Choice:** Remove `Mobile` prefix from all types and components.

**Rationale:** All code in `apps/mobile/` is mobile-specific. The prefix is redundant noise.

| Current | New |
|---------|-----|
| `MobileComposer` | `Composer` |
| `MobileComposerMode` | `ComposerMode` |
| `MobileComposerAttachment` | `ComposerAttachment` |
| `MobileComposerPresentation` | `ComposerPresentation` |

### Decision 2: Replace Meaningless Packaging Terms

**Choice:** Use descriptive names that reflect content, not packaging.

**Rationale:** Words like "Block", "Shell", "State", "Container" describe how something is packaged, not what it is.

| Current | New | Rationale |
|---------|-----|-----------|
| `FeedbackBlock` | `Alert` | It's an alert with error/info variants |
| `LoadingState` | `Loading` | It's an indicator, not a "state" |
| `AuthShell` | `AuthLayout` | It's a layout wrapper |
| `Container` | `Screen` | If kept, it should describe purpose |

### Decision 3: Rename `input/` to `composer/`

**Choice:** Rename the directory from `input/` to `composer/`.

**Rationale:** The directory contains composer-specific code (composer-state, mobile-composer, etc.), not generic input fields. The `input-context.tsx` exports `InputProvider` which should be `ComposerProvider`.

### Decision 4: Standardize File Casing

**Choice:** All component files use PascalCase.tsx, all hook/type files use camelCase.ts.

**Rationale:** Standard React/TypeScript convention. Easy to distinguish at a glance.

| Current | New |
|---------|-----|
| `fade-in.tsx` | `FadeIn.tsx` |
| `session-card.tsx` | `InboxItem.tsx` |
| `use-composer-media-actions.ts` | `useComposerMediaActions.ts` |

### Decision 5: Replace `contracts.ts` with `messages.ts`

**Choice:** Rename `error-boundary/contracts.ts` to `error-boundary/messages.ts`.

**Rationale:** "Contracts" is not TypeScript-canonical. These are message factory functions, so `messages.ts` is accurate.

### Decision 6: Voice Recording/Playback Naming

**Choice:** Rename voice hooks to reflect their role in the composer flow.

**Rationale:** These are part of the composer voice flow, not generic audio utilities.

| Current | New | Rationale |
|---------|-----|-----------|
| `use-recorder.ts` | `useInput.ts` | Records user's voice input |
| `use-playback.ts` | `useResponse.ts` | Plays LLM's voice response |

### Decision 7: Move Hooks to `hooks/` Directory

**Choice:** Move `useResumableSessions` and `useArchivedSessions` from `session-card.tsx` to `mobile/hooks/`.

**Rationale:** These are logic hooks, not presentation. They should live in `hooks/` alongside other app hooks (`use-draft-persistence.ts`, `useHaptics.ts`, etc.).

**Consequence:** `components/chat/session-card.tsx` will only contain the `InboxItem` component.

## Risks / Trade-offs

- [Risk] Many import paths will break → **Mitigation**: Update all imports in a systematic way using the task list
- [Risk] Large refactor across 30+ files could introduce bugs → **Mitigation**: No behavioral changes, only renames; thorough testing after
- [Risk] IDE may not track renames properly → **Mitigation**: Use `pnpm --filter @hominem/mobile run typecheck` after changes to catch any missed imports

## Migration Plan

1. Rename files first (file system changes)
2. Update all import paths
3. Run typecheck to verify no broken imports
4. Run build to verify iOS compilation
5. Run tests to verify functionality

**No rollback needed** - this is a pure rename with no behavioral changes.

## Open Questions

None - all decisions are made. Implementation can proceed directly from tasks.
