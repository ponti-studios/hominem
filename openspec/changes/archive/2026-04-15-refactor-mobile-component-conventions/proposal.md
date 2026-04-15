# refactor-mobile-component-conventions

## Why

The mobile app's `components/` directory suffers from inconsistent naming conventions that obscure component purpose, violate separation of concerns (logic in component files, presentation in hook files), and create friction for developers. The "Mobile" prefix is noise since all code is mobile. Words like "Block", "Shell", "State", "Container" are meaningless packaging terms. The `contracts.ts` naming is not TypeScript-canonical. These issues compound sustainability and onboarding as the codebase grows.

## What Changes

- **Remove "Mobile" prefix** from all types, components, and contexts in mobile/components
- **Eliminate meaningless terms**: replace "Block" with "Alert", "Shell" with "Layout", "State" with type names, "Container" with "Screen"
- **Enforce presentation/logic separation**: hooks MUST be in `mobile/hooks/`, not in component files
- **Rename `input/` directory to `composer/`**: it contains composer-specific code, not generic inputs
- **Standardize file casing**: PascalCase.tsx for components, camelCase.ts for hooks/types
- **Replace `contracts.ts` with `messages.ts`**: rename error-boundary/contracts.ts to error-boundary/messages.ts
- **Consolidate voice recording/playback naming**: `use-recorder` → `useInput`, `use-playback` → `useResponse`
- **Move hooks from component files to hooks/ directory**: `useResumableSessions`, `useArchivedSessions` currently in session-card.tsx

## Capabilities

### New Capabilities

- `mobile-component-conventions`: Naming rules for all mobile React components, hooks, types, and files
- `mobile-component-structure`: Directory organization rules enforcing presentation/logic separation

### Modified Capabilities

- `mobile-composer-draft-persistence`: Type names will change (MobileComposerMode → ComposerMode, etc.) but behavior is unchanged

## Impact

- Renames ~30 files in `apps/mobile/components/`
- Moves 2 hooks from `components/chat/session-card.tsx` to `hooks/`
- Updates ~50 import paths across the mobile app
- No behavioral changes - purely naming and structure cleanup
