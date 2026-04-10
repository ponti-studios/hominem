## Why

The mobile app (`apps/mobile`) has accumulated structural complexity that makes it harder to navigate, maintain, and extend. The `~/lib` vs `~/utils` boundary is unclear, the auth subsystem is spread across 10+ files with overlapping concerns, the config system uses CommonJS `require()` chains, and several patterns (error boundaries as class components, global fetch monkey-patching, dual style systems) add friction without proportionate value.

## What Changes

- **Unify `~/lib/` and `~/utils/`** into a single `~/lib/` directory with semantic subdirectories
- **Simplify auth subsystem** by extracting hooks, merging dual analytics files, and splitting the 492-line `auth-provider.tsx`
- **Convert config files to TypeScript** and resolve `require()` chains
- **Migrate class component error boundaries to function components** using `useEffect` + `useState`
- **Remove `globalThis.fetch` monkey-patching** from `api-connection.tsx`
- **Implement or remove background sync skeleton** (currently only timestamps itself)
- **Standardize on `makeStyles` hook pattern** throughout
- **Consolidate voice/media pipeline** by splitting recorder from transcription concerns
- **Document storage division** (MMKV for flags/timestamps, SQLite for structured data)
- **Clean up HakumiIntents `.build/` artifacts** from source tree

## Capabilities

### New Capabilities

- `lib-reorganization`: Restructure `~/lib/` and `~/utils/` into semantic directories: `~/lib/auth/`, `~/lib/services/`, `~/lib/storage/`, `~/lib/hooks/`, `~/lib/machines/`
- `auth-subsystem-cleanup`: Extract auth hooks (`useBootSequence`, `useEmailOtp`, `usePasskeyAuth`), merge analytics, split state machine
- `config-typescript`: Convert all CommonJS config files to TypeScript modules
- `error-boundary-fp`: Migrate `RootErrorBoundary` and `FeatureErrorBoundary` from class to function components
- `fetch-interceptor-removal`: Remove `globalThis.fetch` monkey-patching from `api-connection.tsx`, rely on `@hominem/rpc` client
- `background-sync-decision`: Either implement real sync or remove the skeleton entirely
- `style-pattern-unification`: Standardize all styling on `makeStyles` hook pattern
- `media-pipeline-split`: Separate audio recording from transcription in voice pipeline

### Modified Capabilities

<!-- No existing specs exist yet, so no modified capabilities -->

## Impact

- `apps/mobile/` — primary target of all changes
- `apps/mobile/utils/auth/` — restructuring and hook extraction
- `apps/mobile/lib/` — absorbing `~/utils/` contents
- `apps/mobile/config/` — CommonJS to TypeScript conversion
- `apps/mobile/components/error-boundary/` — class to function migration
- `apps/mobile/utils/api-connection.tsx` — fetch interceptor removal
- `apps/mobile/lib/background-sync.ts` — implement or remove
- `apps/mobile/components/media/` — voice pipeline refactor
