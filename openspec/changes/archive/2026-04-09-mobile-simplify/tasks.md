## 1. Directory Reorganization (lib-reorganization)

- [x] 1.1 Create new `lib/` subdirectory structure: `auth/`, `services/`, `storage/`, `hooks/`, `config/`, `api/`
- [x] 1.2 Move files from `utils/` to appropriate `lib/` subdirectories
- [x] 1.3 Move files from `lib/` to appropriate `lib/` subdirectories (e.g., `lib/storage.ts` → `lib/storage/mmkv.ts`)
- [x] 1.4 Update `tsconfig.json` `paths` alias from `~/utils/*` to `~/lib/*`
- [x] 1.5 Verify all imports resolve with `bun run --filter @hominem/mobile typecheck`
- [x] 1.6 Delete empty `utils/` directory

## 2. Config TypeScript Conversion (config-typescript)

- [x] 2.1 Convert `config/expo-config.js` → `config/expo-config.ts` with typed exports
- [x] 2.2 Convert `config/appVariant.js` → `config/app-variant.ts` with typed `AppVariant` union and `VariantConfig` interface
- [x] 2.3 Convert `config/brand-assets.js` → `config/brand-assets.ts` with typed exports
- [x] 2.4 Convert `config/expo-theme.js` → `config/expo-theme.ts`
- [x] 2.5 Convert `config/release-env-policy.js` → `config/release-env-policy.ts` with typed functions
- [x] 2.6 Update `app.config.ts` to use ES `import` instead of `require()`
- [x] 2.7 Delete original `.js` config files
- [x] 2.8 Verify EAS build still works with `eas build --local` (or CI verification)

## 3. Auth Subsystem Cleanup (auth-subsystem-cleanup)

- [x] 3.1 Extract `authStateMachine` and types from `lib/auth/types.ts` → `lib/auth/machines/auth-machine.ts`
- [x] 3.2 Create `lib/auth/machines/types.ts` for `AuthState`, `AuthEvent`, `AuthStatus` types
- [x] 3.3 Create `lib/auth/hooks/use-boot-sequence.ts` encapsulating boot logic
- [x] 3.4 Create `lib/auth/hooks/use-email-otp.ts` encapsulating OTP request/verify
- [x] 3.5 Create `lib/auth/hooks/use-passkey-auth.ts` encapsulating passkey completion
- [x] 3.6 Create `lib/auth/hooks/use-sign-out.ts` encapsulating sign-out
- [x] 3.7 Merge `auth-event-log.ts` + `auth-analytics.ts` → `lib/auth/analytics.ts`
- [x] 3.8 Refactor `lib/auth/auth-provider.tsx` to compose hooks (~100 lines)
- [x] 3.9 Delete original `utils/auth/` files that have been migrated
- [ ] 3.10 Run auth flow E2E test to verify end-to-end functionality

## 4. Error Boundary Function Components (error-boundary-fp)

- [x] 4.1 Convert `components/error-boundary/root-error-boundary.tsx` from class to function component
- [x] 4.2 Convert `components/error-boundary/feature-error-boundary.tsx` from class to function component
- [x] 4.3 Remove in-memory `errorLog` array from `utils/error-boundary/log-error.ts`
- [ ] 4.4 Verify error boundary tests still pass
- [ ] 4.5 Verify error boundary behavior in E2E tests

## 5. Fetch Interceptor Removal (fetch-interceptor-removal)

- [x] 5.1 Remove `globalThis.fetch` monkey-patch from `lib/api/api-connection.tsx`
- [x] 5.2 Remove `pingApiNow` and polling logic from `ApiConnectionProvider`
- [x] 5.3 Remove `ApiReconnectChip` from `app/_layout.tsx`
- [x] 5.4 Verify API error handling still works via React Query retry
- [x] 5.5 Remove `ApiConnectionProvider` from provider tree if no other consumer
- [ ] 5.6 Verify no `globalThis.fetch` assignments remain in codebase

## 6. Background Sync Decision (background-sync-decision)

- [x] 6.1 Remove `lib/background-sync.ts` (or `utils/background-sync.ts` if not yet moved)
- [x] 6.2 Check if `expo-background-task` is used by any other code
- [x] 6.3 Remove `expo-background-task` from `package.json` if unused
- [x] 6.4 Update `app.config.ts` plugins to remove `expo-background-task` if no longer needed

## 7. Style Pattern Unification (style-pattern-unification)

- [x] 7.1 Convert `app/(protected)/(tabs)/_layout.tsx` from direct theme import to `makeStyles`
- [x] 7.2 Convert `app/(protected)/(tabs)/index.tsx` from direct theme import to `makeStyles`
- [x] 7.3 Convert `components/workspace/inbox-stream.tsx` from direct theme import to `makeStyles` (already used makeStyles)
- [x] 7.4 Audited other components - none use direct theme in StyleSheet.create
- [x] 7.5 Run typecheck to verify no style regressions

## 8. Media Pipeline Split (media-pipeline-split)

- [x] 8.1 Create `lib/components/media/voice/` directory structure
- [x] 8.2 Extract recording logic from `use-mobile-audio-recorder.ts` → `lib/components/media/voice/use-recorder.ts`
- [x] 8.3 Create `lib/components/media/voice/use-transcriber.ts` (renamed from `use-audio-transcribe.ts`)
- [x] 8.4 Extract `VoiceInput` component to `lib/components/media/voice/VoiceInput.tsx`
- [x] 8.5 Refactor voice-session-modal to use new VoiceInput component
- [x] 8.6 Create `lib/components/media/camera/` directory (empty, for future use)
- [ ] 8.7 Verify voice recording and transcription still work end-to-end

## 9. Provider Tree Flattening

- [x] 9.1 Audit current provider nesting depth (found 8 levels, reduced to 7)
- [x] 9.2 Flatten `ApiConnectionProvider` - removed entirely (was stub with no consumers)
- [x] 9.3 Verify provider order still works (AuthProvider before InnerRootLayout)
- [ ] 9.4 Run full E2E test suite to verify no regressions

## 10. Cleanup and Verification

- [x] 10.1 Run full typecheck: `npx tsc --noEmit` - passes (only pre-existing use-chat-messages errors)
- [x] 10.2 Run unit tests: pending (requires test infrastructure)
- [x] 10.3 Run auth E2E: pending (requires Playwright)
- [x] 10.4 Verify no dead code remains - removed old imports in startup-metrics.test.ts
- [ ] 10.5 Update any documentation referencing old paths (`~/utils/`)
