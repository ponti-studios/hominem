## Context

`@hominem/utils` has 15+ submodules consumed across API, mobile, and web. The package currently exports modules from `@hominem/chat`, `@hominem/auth`, `services/api`, and cross-cutting concerns — all in one barrel. The goal is to move each submodule to its correct owning package so imports reflect code ownership, not a catch-all utility namespace.

Current `@hominem/utils` exports and their consumers:

| Submodule | Consumers | Proposed Owner |
|---|---|---|
| `api-response-validation` | API routes, mobile, web | Route-local (files, voice) |
| `consts` | API, queues | `@hominem/queues` |
| `headers` | API auth routes | `@hominem/auth` |
| `error-types` | API, mobile, web | `@hominem/auth` |
| `google` | API image routes | `services/api/src/routes/images.ts` |
| `images` | API image routes | `services/api/src/routes/images.ts` |
| `storage` | API file routes | `services/api/src/storage/` |
| `upload` | mobile, web, UI, storage | `@hominem/chat` |
| `dates` | mobile, UI, services | Split: generic utils / `@hominem/chat` |
| `time` | mobile, services | Split: generic utils / `@hominem/chat` |
| `markdown` | API, services | `@hominem/chat` |
| `logger`, `client-logger`, `logger.shared` | API, mobile, web, services | Keep in `@hominem/utils` |
| `delay`, `http` | API, services | Keep in `@hominem/utils` |

## Goals / Non-Goals

**Goals:**
- Each submodule lives in the package that owns the concern it implements
- No new packages created unless a submodule has multiple distinct consumers that cannot be co-located
- `@hominem/utils` retains only genuinely cross-cutting helpers with no other obvious home
- All import paths updated atomically across the monorepo

**Non-Goals:**
- Not a full rewrite of any module — only move code to its correct package
- Not creating `@hominem/storage`, `@hominem/logging`, `@hominem/date-utils` as separate packages unless complexity demands it
- Not changing any runtime behavior — only import paths and package boundaries

## Decisions

### 1. Response schemas → route-local files

`VoiceTranscribeSuccessSchema`, `VoiceTranscribeErrorSchema`, and `UploadResponseSchema` are HTTP wire contracts. They belong with the API routes that define them.

**Decision**: Move each schema to the route file that owns the endpoint, or a co-located `schema.ts` next to the route. Delete `@hominem/utils/api-response-validation`.

**Rationale**: These are not shared application logic — they are transport contracts consumed only by the routes that define them and the clients that call those routes. Route-local schemas follow the existing pattern in `services/api/src/rpc/routes/`.

### 2. Queue constants → `@hominem/queues`

`QUEUE_NAMES` and `REDIS_CHANNELS` are already imported by `@hominem/queues`. Moving them there eliminates the utils dependency for these constants.

**Decision**: Move `consts.ts` content into `@hominem/queues/src/consts.ts`.

**Alternatives considered**: Creating a new `@hominem/platform-consts` package was rejected — `@hominem/queues` is the only logical owner since queues are the only consumer of these constants.

### 3. Auth helpers → `@hominem/auth`

`getSetCookieHeaders` and `parseAuthError` / `getErrorMessage` are auth infrastructure used only in auth-related code.

**Decision**: Move `headers.ts` to `@hominem/auth/src/server/headers.ts` and `error-types.ts` to `@hominem/auth/src/server/error-types.ts`. Export from `@hominem/auth/server-utils`.

### 4. Image helpers → API route co-location

`isValidGoogleHost`, `getHominemPhotoURL`, `normalizePhotoReference`, `sanitizeStoredPhotos` are all image-processing logic used only by the image proxy route.

**Decision**: Move `google.ts` and `images.ts` into `services/api/src/routes/images.ts` (or a co-located `images/` directory within the routes folder).

### 5. Storage service → API co-location

`R2StorageService`, `csvStorageService`, `fileStorageService`, `placeImagesStorageService` are used exclusively by API file routes and workers.

**Decision**: Move `storage/` to `services/api/src/storage/`. Keep `@hominem/utils/storage` exports as re-exports during a transition period, then remove once all consumers are updated.

### 6. Upload policy and attachment formatting → `@hominem/chat`

`CHAT_UPLOAD_ALLOWED_MIME_TYPES`, `CHAT_UPLOAD_MAX_FILE_COUNT`, `isSupportedChatUploadMimeType`, and the attachment formatting helpers (`formatUploadedFileContext`, `appendNoteAttachments`, etc.) are chat domain logic.

**Decision**: Move `upload/` to `packages/domains/chat/src/upload/`. Export from `@hominem/chat`.

### 7. Date/time → split ownership

`parseInboxTimestamp` and `formatMessageTimestamp` are inbox/chat domain formatting. `getTimeAgo` and `formatTime` are generic time helpers used across the monorepo.

**Decision**: Move `formatMessageTimestamp` and `parseInboxTimestamp` to `@hominem/chat`. Keep `TIME_UNITS`, `formatTime`, `getTimeAgo` in `@hominem/utils`.

### 8. Markdown processing → `@hominem/chat`

`splitMarkdown` and `Document` are used by the notes/chat domain for content chunking.

**Decision**: Move `markdown/` to `packages/domains/chat/src/markdown/`. Export from `@hominem/chat`.

### 9. Logging stays in `@hominem/utils`

`logger.ts`, `client-logger.ts`, and `logger.shared.ts` are the cross-cutting observability layer. Splitting them into a separate package creates churn without boundary benefit since all three packages already depend on utils.

**Decision**: Keep logging modules in `@hominem/utils`.

### 10. Re-export transition strategy

To avoid breaking all consumers simultaneously, use a re-export bridge in `@hominem/utils` during migration:

```typescript
// @hominem/utils/src/index.ts — transition only, delete after all consumers migrate
export { fileStorageService } from '@hominem/storage'; // temporary re-export
```

Once all import paths are updated, delete the re-exports.

## Risks / Trade-offs

- **[Risk] Many import paths change simultaneously** → Mitigation: Use a staged migration — update producers first (move code), then update all consumers before deleting old re-exports from `@hominem/utils`
- **[Risk] `@hominem/chat` grows large** → Mitigation: `@hominem/chat` already owns the chat domain; upload, markdown, and date formatting are legitimate domain concerns
- **[Risk] Mobile still needs `@hominem/utils`** → Mitigation: Mobile will import from the new locations; `@hominem/utils` shrinks but does not disappear entirely
- **[Risk] LangChain deps migrate to `@hominem/chat`** → Mitigation: Only `@langchain/textsplitters` is used; `@hominem/chat` gains this dependency

## Open Questions

- Should `markdown/` become its own `@hominem/markdown` package if it diverges further between web (rendering) and API (chunking)? For now, co-locating in `@hominem/chat` is the lower-churn path.
- Is `@hominem/services` the right home for `storage/` during transition, or should it live in the API directly? Decision: API co-location is correct; services package is not needed as an intermediary.

## Implementation Notes

### Deviations from Original Design

**Decision 1 (api-response-validation):** Schemas moved to `@hominem/rpc/schemas/` instead of route-local files. The `services/api/src/routes/` path is not accessible from web/mobile workspaces. RPC package already has `"./schemas/*"` exports and is the correct location for shared wire contract schemas.

**Decision 5 (storage):** Storage stayed in `@hominem/utils/storage` instead of moving to `services/api/src/storage/`. The API and `@hominem/utils` are separate workspace packages, and storage is used by API routes. Keeping it in utils avoids a cross-workspace dependency.

**Decision 4 (images):** Only `isValidGoogleHost` moved to `services/api/src/routes/images.ts`. The `images.ts` functions (`getHominemPhotoURL`, etc.) have no consumers and were left as dead code in `@hominem/utils`.

### Key Implementation Decisions

- `@hominem/chat` gained `date-fns` and `@langchain/textsplitters` dependencies
- `@hominem/web` gained `@hominem/chat` as a dependency for upload/date imports
- Circular dependency between `@hominem/utils/storage` and `@hominem/chat` broken by inlining `isSupportedChatUploadMimeType` in r2-storage.ts
- `isTestMode()` inlined in web hook since it was the only utils/storage consumer in web
