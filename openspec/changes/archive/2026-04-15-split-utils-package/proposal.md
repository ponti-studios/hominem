## Why

`@hominem/utils` is a catch-all package containing 15+ unrelated submodules: S3/R2 storage, HTTP image downloading, Google API helpers, date formatting, markdown processing, logging, chat upload policy, queue constants, and more. This violates single-responsibility and makes it impossible to use one concern without pulling in all others. The package also contains code that belongs in domain packages, RPC contracts, or platform services — not a shared utilities barrel.

Several modules already migrated into `@hominem/utils` should not be there at all: HTTP response parsing belongs with API routes, queue constants belong with the queue package, and image URL normalization belongs with the image service. The remaining modules need to be evaluated for the right ownership boundary.

## What Changes

- Move `api-response-validation` schemas to route-local files (voice, files routes) — no new package needed
- Move `consts.ts` (queue names, Redis channels) to `@hominem/queues`
- Move `headers.ts` (`getSetCookieHeaders`) to `@hominem/auth/server-utils`
- Move `error-types.ts` (`parseAuthError`, `getErrorMessage`) to `@hominem/auth`
- Move `google.ts` (`isValidGoogleHost`) to `services/api/src/routes/images.ts`
- Move `images.ts` (photo URL normalization) to `services/api/src/routes/images.ts`
- Move `storage/r2-storage.ts` to a new `services/api/src/storage/` directory (or `@hominem/storage` if a second consumer emerges)
- Move `upload/` (mime types, attachment formatting) to `@hominem/chat`
- Move `dates.ts` and `time.ts` — keep generic `TIME_UNITS`, `formatTime`, `getTimeAgo` in utils; move `parseInboxTimestamp`, `formatMessageTimestamp`, `formatChatDate` to `@hominem/chat`
- Move `markdown/` to `@hominem/chat` (or a dedicated `@hominem/markdown` if web and mobile diverge)
- Keep `logger.ts`, `client-logger.ts`, `logger.shared.ts` in `@hominem/utils` — observability is a valid shared concern
- Keep `delay`, `http.ts`, and generic `TIME_UNITS` in `@hominem/utils`

**BREAKING**: All import paths from `@hominem/utils/<submodule>` will change. Consumers in API, mobile, and web must be updated to import from the new owning package.

## Capabilities

### New Capabilities

- `utils-module-boundaries`: Documents where each former utils submodule now lives and the import path update required

### Modified Capabilities

- `upload-state-machine`: Upload mime-type validation and attachment formatting moves from `@hominem/utils/upload` to `@hominem/chat` — spec unchanged, only import paths shift
- `direct-upload-contract`: Same as above — spec unchanged, import paths shift
- `test-storage-interface`: `fileStorageService` moves from `@hominem/utils/storage` to `services/api/src/storage/` — spec unchanged, import paths shift

## Impact

- **Packages affected**: `@hominem/utils`, `@hominem/chat`, `@hominem/queues`, `@hominem/auth`, `services/api`
- **Apps affected**: `apps/web`, `apps/mobile` — import paths for `dates`, `upload`, `storage` will change
- **Dependencies removed from `@hominem/utils`**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@langchain/core`, `@langchain/textsplitters`
- **Dependencies that stay**: `date-fns`, `pino`, `zod`, `@opentelemetry/api`, `@opentelemetry/api-logs`
