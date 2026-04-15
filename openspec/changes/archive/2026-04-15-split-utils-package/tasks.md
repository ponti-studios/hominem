# Tasks: split-utils-package

Breakdown of implementation work for splitting `@hominem/utils` into correct owning packages.

## 1. Move `api-response-validation` to RPC schemas

**Owner**: API routes team

- [x] Move `VoiceTranscribeSuccessSchema`, `VoiceTranscribeErrorSchema` to `packages/platform/rpc/src/schemas/voice.schema.ts`
- [x] Move `UploadResponseSchema` to `packages/platform/rpc/src/schemas/files.schema.ts`
- [x] Delete `@hominem/utils/src/api-response-validation.ts`
- [x] Remove `@hominem/utils` export for `api-response-validation`
- [x] Update `apps/web/app/lib/hooks/use-file-upload.ts` to import from `@hominem/rpc/schemas/files.schema`
- [x] Update `apps/web/app/hooks/use-transcribe.ts` to import from `@hominem/rpc/schemas/voice.schema`
- [x] Update `apps/mobile/services/files/use-file-upload.ts` to import from `@hominem/rpc/schemas/files.schema`
- [x] Update `apps/mobile/components/media/voice/useTranscriber.ts` to import from `@hominem/rpc/schemas/voice.schema`
- [x] Remove `@hominem/utils` from `services/api` dependencies (if no other imports remain)

## 2. Move `consts` to `@hominem/queues`

**Owner**: Infrastructure

- [x] Create `@hominem/queues/src/consts.ts` with content from `@hominem/utils/consts.ts`
- [x] Delete `@hominem/utils/consts.ts`
- [x] Remove `consts` export from `@hominem/utils/src/index.ts` (not in index.ts, only package.json export)
- [x] Update `@hominem/queues` internal imports to use local consts
- [x] Remove `consts` from `@hominem/utils` exports in `packages/core/utils/package.json`

## 3. Move `headers` and `error-types` to `@hominem/auth`

**Owner**: Auth

- [x] Create `@hominem/auth/src/server/headers.ts` with `getSetCookieHeaders`
- [x] Create `@hominem/auth/src/server/error-types.ts` with `parseAuthError`, `getErrorMessage`
- [x] Export both from `@hominem/auth/server-utils.ts`
- [x] Delete `@hominem/utils/headers.ts`
- [x] Delete `@hominem/utils/error-types.ts`
- [x] Remove both exports from `@hominem/utils/src/index.ts`
- [x] Update `services/api/src/routes/auth-helpers.ts` to import from `@hominem/auth/server-utils`
- [x] `apps/web/app/root.tsx` already uses `error.message` — no auth error imports remain
- [x] Checked `services/api/src/middleware/` — no remaining `@hominem/utils` auth imports

## 4. Move `google` to API image route

**Owner**: API routes

- [x] Inlined `isValidGoogleHost` in `services/api/src/routes/images.ts` (only consumer)
- [x] Deleted `@hominem/utils/google.ts`
- [x] Removed `./google` export from `packages/core/utils/package.json`
- [x] `images.ts` functions (`getHominemPhotoURL`, `normalizePhotoReference`, etc.) are not imported anywhere — left in `@hominem/utils` for now
- [x] Removed `./google` from `@hominem/utils` exports

## 5. Keep `storage` in `@hominem/utils` (pragmatic decision)

**Owner**: API infrastructure

- [x] Evaluated moving storage to `services/api/src/storage/` — rejected due to cross-workspace complexity
- [x] API already depends on `@hominem/utils` and uses `fileStorageService` there
- [x] `isTestMode` removed from utils export (was only used by web, now inlined locally)
- [x] `fileStorageService` stays in `@hominem/utils/storage` for now

## 6. Move `upload` to `@hominem/chat`

**Owner**: Chat domain

- [x] Created `packages/domains/chat/src/upload/mime-types.ts` with MIME types and `isSupportedChatUploadMimeType`
- [x] Created `packages/domains/chat/src/upload/formatting.ts` with attachment formatting helpers
- [x] Created `packages/domains/chat/src/upload/index.ts`
- [x] Exported upload from `@hominem/chat/public.ts` (main types entry)
- [x] Deleted `@hominem/utils/upload/` directory
- [x] Removed upload export from `@hominem/utils/package.json`
- [x] Updated `apps/web/app/lib/hooks/use-file-upload.ts` to import from `@hominem/chat`
- [x] Updated `apps/mobile/services/files/use-file-upload.ts` to import from `@hominem/chat`
- [x] Updated `apps/mobile/components/composer/useComposerMediaActions.ts` to import from `@hominem/chat`
- [x] Updated `packages/platform/ui/src/components/composer/composer-attachments.ts` to import from `@hominem/chat`
- [x] Updated `@hominem/utils/storage/r2-storage.ts` to inline `isSupportedChatUploadMimeType` (breaks circular dep)

## 7. Move `dates` (partial) to `@hominem/chat`

**Owner**: Chat domain

- [x] Created `packages/domains/chat/src/dates.ts` with `parseInboxTimestamp`, `formatMessageTimestamp`, `formatChatDate`
- [x] Exported dates from `@hominem/chat/public.ts`
- [x] Updated `apps/mobile/components/workspace/InboxStreamItem.tsx` to import from `@hominem/chat`
- [x] Updated `apps/mobile/services/date/date/format-relative-age.ts` to import from `@hominem/chat`
- [x] Updated `apps/mobile/services/chat/session-state.ts` to import from `@hominem/chat`
- [x] Updated `apps/mobile/services/inbox/inbox-refresh.ts` to import from `@hominem/chat`
- [x] Updated `packages/platform/ui/src/components/chat/chat-message.tsx` to import from `@hominem/chat`
- [x] Removed moved functions from `@hominem/utils/dates.ts` (kept generic utilities)
- [x] Added `date-fns` dependency to `@hominem/chat`
- [x] Added `@hominem/chat` dependency to `@hominem/web` (for upload imports)
- [x] `TIME_UNITS` stays in `@hominem/utils/time` (generic utility, used by mobile)

## 8. Move `markdown` to `@hominem/chat`

**Owner**: Chat domain

- [x] Created `packages/domains/chat/src/markdown/markdown-processor.ts` with `splitMarkdown`, `Document`
- [x] Created `packages/domains/chat/src/markdown/index.ts`
- [x] Exported markdown from `@hominem/chat/public.ts`
- [x] Deleted `@hominem/utils/markdown/` directory
- [x] Removed markdown export from `@hominem/utils/src/index.ts`
- [x] Removed markdown export from `@hominem/utils/package.json`
- [x] Added `@langchain/textsplitters` dependency to `@hominem/chat`
- [x] No consumers existed in web or API — no import updates needed

## 9. Update all consumers in `apps/web`

**Owner**: Web team

- [x] Audited `@hominem/utils` imports — only `getTimeAgo` from time remains (stays in utils)
- [x] Updated `use-file-upload.ts` to import upload from `@hominem/chat` and schema from `@hominem/rpc`
- [x] Kept `@hominem/utils` in `apps/web/package.json` (still used for logger, time utilities)
- [x] Typecheck passes: `pnpm --filter @hominem/web run typecheck`
- [x] Web has no test files

## 10. Update all consumers in `apps/mobile`

**Owner**: Mobile team

- [x] Audited `@hominem/utils` imports — only `TIME_UNITS` and `getTimeAgo` remain (stays in utils)
- [x] Updated `use-file-upload.ts`, `useComposerMediaActions.ts` to import from `@hominem/chat`
- [x] Updated `InboxStreamItem.tsx`, `session-state.ts`, `inbox-refresh.ts`, `format-relative-age.ts` to import from `@hominem/chat`
- [x] Kept `@hominem/utils` in `apps/mobile/package.json` (still used for logger, time utilities)
- [x] Typecheck passes: `pnpm --filter @hominem/mobile run typecheck`
- [x] Tests pass: 35 passed

## 11. Update all consumers in `services/api`

**Owner**: API team

- [x] Audited `@hominem/utils` imports — `logger`, `storage`, `delay` remain (stays in utils)
- [x] Updated `auth-helpers.ts` to import `getSetCookieHeaders` from `@hominem/auth`
- [x] Updated `file-processing.ts` to import `QUEUE_NAMES` from `@hominem/queues`
- [x] Kept `@hominem/utils` in `services/api/package.json` (still used for logger, storage, delay)
- [x] Typecheck passes

## 12. Clean up `@hominem/utils`

**Owner**: Platform

- [x] Removed `date-fns` dependency (moved to `@hominem/chat`)
- [x] Kept `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (needed for storage)
- [x] Kept `@langchain/core`, `@langchain/textsplitters` (potential future use)
- [x] No re-export transition bridges needed
- [x] Verified exports: `delay`, `TIME_UNITS`, `formatTime`, `getTimeAgo`, `getDatesFromText`, `storage`, `logger`, `client-logger`, generic dates/location/http
- [x] Full typecheck passes across monorepo
- [x] Tests: 35 mobile, 3 chat, 2 UI — all pass

## 13. Verify and finalize

- [x] `pnpm --filter @hominem/utils run typecheck` passes
- [x] `pnpm exec knip` — no orphan `@hominem/utils` imports
- [x] Design decisions implemented (with deviations noted)
- [x] `isComplete: true` in openspec status
