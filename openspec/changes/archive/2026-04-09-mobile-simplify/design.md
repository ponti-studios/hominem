## Context

The mobile app (`apps/mobile`) is an Expo Router + React Native application with ~159 TypeScript files. During an exploratory analysis, several structural simplification opportunities were identified:

- **Directory split**: `~/lib/` (singleton instances) vs `~/utils/` (everything else) has no clear guiding principle
- **Auth subsystem**: 10+ files with overlapping concerns (analytics, state machine, boot, validation, routing)
- **Config system**: 5 CommonJS files using `require()` chains imported by `app.config.ts`
- **Error boundaries**: Class components in 2024 React Native ecosystem
- **Global side effects**: `api-connection.tsx` monkey-patches `globalThis.fetch`
- **Style patterns**: Dual patterns (`makeStyles` hook vs direct `theme` import)
- **Background sync**: Registered background task that only timestamps itself — no actual sync

**Constraints:**
- Must not break existing functionality
- Auth flow must remain secure (session management, token handling)
- Expo config (`app.config.ts`) must remain valid for EAS builds
- React Native compatibility (New Architecture enabled)

## Goals / Non-Goals

**Goals:**
- Reduce cognitive overhead when navigating the codebase
- Make the directory structure self-documenting through semantic grouping
- Remove dead code and skeleton features
- Eliminate global side effects (fetch monkey-patching)
- Modernize React patterns (class → function components)

**Non-Goals:**
- Not rewriting the auth flow — only restructuring and extracting hooks
- Not changing the visual design or UI
- Not modifying the API contract or RPC layer
- Not adding new features — purely structural simplification
- Not changing the Expo Router file-based routing structure

## Decisions

### 1. Flatten `~/lib/` and `~/utils/` into semantic `~/lib/` subdirectories

**Decision:** Merge both directories into `~/lib/` with clear subdirectories:

```
lib/
├── auth/
│   ├── auth-provider.tsx      # composition root only
│   ├── machines/
│   │   ├── types.ts           # AuthState, AuthEvent types
│   │   └── auth-machine.ts     # authStateMachine reducer (extracted from types.ts)
│   ├── hooks/
│   │   ├── use-boot-sequence.ts
│   │   ├── use-email-otp.ts
│   │   ├── use-passkey-auth.ts
│   │   └── use-sign-out.ts
│   ├── storage/
│   │   ├── session-cookie.ts
│   │   └── local-profile.ts
│   └── analytics.ts            # merged from auth-event-log + auth-analytics
├── services/                  # React Query hooks (chat, notes, inbox, files)
├── storage/
│   ├── mmkv.ts                # unified MMKV exports (from lib/storage.ts)
│   └── sqlite/
│       ├── index.ts           # validation + singleton init
│       └── sqlite.ts          # raw SQLite implementation
├── hooks/                      # standalone hooks (useAppLock, useReducedMotion, etc.)
├── config/                     # TypeScript config files (converted from JS)
│   ├── expo-config.ts
│   ├── app-variant.ts
│   ├── brand-assets.ts
│   ├── expo-theme.ts
│   └── release-env-policy.ts
├── api/
│   ├── api-provider.tsx       # (from utils/)
│   └── api-connection.tsx     # fetch monkey-patch REMOVED, reconnect via RPC client
└── ...
```

**Alternatives considered:**
- Keep both `~/lib/` and `~/utils/` with clearer documentation — rejected because the split is arbitrary
- Move everything to `~/src/` — rejected, too disruptive for minimal gain
- Subdirectories by feature (auth, chat, notes) — rejected, some utilities span multiple features

### 2. Auth subsystem — extract hooks, merge analytics

**Decision:** Extract boot, OTP, passkey, and sign-out into dedicated hooks. Merge dual analytics files.

Key changes:
- `auth-provider.tsx` becomes ~100 lines — only composes hooks and provides context
- `auth-event-log.ts` + `auth-analytics.ts` → `analytics.ts` (merged)
- State machine moves to `machines/auth-machine.ts`
- `lib/auth-client.ts` (20 lines) inlined into `auth-provider.tsx` — unnecessary indirection

**Extracted hooks:**
- `useBootSequence` — encapsulates `runAuthBoot`, timeout management
- `useEmailOtp` — encapsulates `requestEmailOtp`, `verifyEmailOtp` with timeout
- `usePasskeyAuth` — encapsulates `completePasskeySignIn`
- `useSignOut` — encapsulates `signOut` with cleanup

### 3. Config — CommonJS to TypeScript conversion

**Decision:** Convert all `config/*.js` files to `.ts`, replacing `require()` with `import`.

```
config/
├── expo-config.ts     # was expo-config.js
├── app-variant.ts     # was appVariant.js
├── brand-assets.ts    # was brand-assets.js
├── expo-theme.ts      # was expo-theme.js
└── release-env-policy.ts  # was release-env-policy.js
```

Each file exports TypeScript types and functions. `app.config.ts` uses ES imports instead of `require()`.

**Migration:** Convert one file at a time, verify `app.config.ts` still resolves correctly before proceeding.

### 4. Error boundaries — class to function components

**Decision:** Migrate both `RootErrorBoundary` and `FeatureErrorBoundary` from class components to function components using `useEffect` + `useState`.

```typescript
// Before (class)
class RootErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State { ... }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { ... }
  render() { ... }
}

// After (function)
function RootErrorBoundary({ children, fallback, onError }: Props) {
  const [state, setState] = useState<BoundaryState>({ hasError: false, error: null });

  useEffect(() => {
    // Equivalent to componentDidCatch
  }, []);

  if (state.hasError) { return fallback ?? <DefaultFallback error={state.error} />; }
  return children;
}
```

The error state initialization, reset via `resetBoundaryState()`, and logging via `logError` remain unchanged.

### 5. `api-connection.tsx` — remove fetch monkey-patch

**Decision:** Remove the `globalThis.fetch` interception entirely. Rely on `@hominem/rpc` client for API calls. The `ApiReconnectChip` component becomes a no-op or is removed.

**Rationale:** The RPC client already handles errors. The fetch monkey-patch is a global side effect that can break third-party libraries. The reconnect polling (10s interval) is redundant with React Query's retry logic.

**Migration:**
1. Remove `globalThis.fetch` replacement in `ApiConnectionProvider`
2. Remove `pingApiNow` logic
3. `ApiReconnectChip` renders nothing or shows a static "API ready" indicator
4. Keep the `ApiConnectionProvider` wrapper if other code depends on it, otherwise flatten into `ApiProvider`

### 6. Background sync — implement or remove

**Decision:** Remove the skeleton. The background task currently only timestamps itself with no actual sync logic.

```typescript
// REMOVE from lib/background-sync.ts:
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  storage.set('background_sync_last_run', new Date().toISOString());
  return BackgroundTask.BackgroundTaskResult.Success;
});
```

If real background sync is needed in the future, it should be specced separately with actual implementation.

### 7. Style patterns — standardize on `makeStyles`

**Decision:** Convert all direct `theme` imports for styling to `makeStyles` hook pattern.

Files using direct `theme` import for styles:
- `mobile-composer.tsx`
- `tabs/_layout.tsx`
- `inbox-stream.tsx`

Migration: Wrap style objects in `useStyles()` hook with `makeStyles`.

### 8. Media/voice pipeline — split concerns

**Decision:** Extract transcription triggering from `useMobileAudioRecorder` into a separate concern.

```
components/media/
├── voice/
│   ├── use-recorder.ts         # core recording + metering polling
│   ├── use-transcriber.ts     # transcription (from use-audio-transcribe.ts)
│   ├── use-tts.ts             # (already separate)
│   ├── VoiceInput.tsx          # UI component
│   └── VoiceSessionModal.tsx
└── camera/
    └── CameraModal.tsx
```

`useRecorder` returns `{ isRecording, meterings, startRecording, stopRecording }`. Transcription is triggered by the caller (e.g., `VoiceSessionModal`) via `useTranscriber`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Moving files breaks imports across the codebase | Use `npx expo-rename` or manual path updates; run typecheck after each move |
| Auth hook extraction introduces race conditions | Keep boot sequence as a single atomic operation; hooks only manage UI state |
| Removing fetch monkey-patch breaks reconnect detection | Rely on React Query's built-in retry + `@hominem/rpc` error handling |
| Class → function error boundary changes error handling behavior | Function equivalent using `useEffect` has same semantics |
| Config TypeScript conversion introduces type errors | Convert incrementally; one file at a time |

## Migration Plan

1. **Phase 1 — Directory restructure** (`lib-reorganization`)
   - Create new directory structure
   - Move files one subdirectory at a time
   - Verify imports resolve after each move
   - Run `bun run --filter @hominem/mobile typecheck` after each move

2. **Phase 2 — Config TypeScript** (`config-typescript`)
   - Convert one config file per commit
   - Verify `app.config.ts` still builds

3. **Phase 3 — Auth subsystem** (`auth-subsystem-cleanup`)
   - Extract hooks first (tests should pass after each)
   - Merge analytics files
   - Split state machine
   - Keep auth flow working end-to-end throughout

4. **Phase 4 — Cleanup passes** (remaining capabilities)
   - Error boundary migration
   - Fetch interceptor removal
   - Background sync removal
   - Style pattern unification
   - Media pipeline split

Each phase should be deployable independently if tests pass.

## Open Questions

1. **Provider nesting**: Should `ApiConnectionProvider` be flattened into `ApiProvider`? The `ApiReconnectChip` currently depends on `ApiConnectionContext`. If removed, the flattening is trivial.

2. **HakumiIntents `.build/` directory**: Should these compiled artifacts be gitignored or removed from the repo entirely?

3. **Storage facade**: Should MMKV (`storage.ts`) and SQLite (`local-store/`) be unified under a single storage interface, or keep separate given they serve different data shapes?

4. **`notes-surface-motion.ts`**: This file lives in `components/notes/` but is only used by `mobile-composer.tsx`. Should it move to `utils/motion.ts`?
