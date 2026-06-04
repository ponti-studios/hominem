# File Storage Analysis

This document summarizes the current file storage architecture, the issues found while tracing storage usage across the repo, and examples of better patterns to use going forward.

## Current Storage Surfaces

### Core Storage Package

Canonical package: `@hominem/storage`

Key files:

- `packages/core/storage/src/r2-storage.ts`
- `packages/core/storage/src/upload-policy.ts`
- `packages/core/storage/src/index.ts`

Responsibilities:

- Create storage clients with `createStorageService`.
- Provide preconfigured clients such as `fileStorageService`.
- Store and delete objects from R2 or the in-memory test backend.
- Define upload policy helpers such as `validateFile`, `resolveUploadMimeType`, and upload size/type constants.

### General File API

Key file:

- `services/api/src/rpc/routes/files.ts`

Responsibilities:

- Authenticated file upload, listing, fetching, URL lookup, and deletion.
- Stores object bytes through `fileStorageService`.
- Persists metadata through `FileRepository`.
- Enqueues `fileProcessingQueue` jobs after upload.

### Web Upload Client

Key file:

- `apps/web/app/lib/hooks/use-file-upload.ts`

Responsibilities:

- Uses Uppy + XHRUpload to POST files to `/api/files`.
- Uses shared upload constants from `@hominem/storage`.
- Maps API upload responses into web `UploadedFile` objects.

### Mobile Upload Client

Key file:

- `apps/mobile/services/files/use-file-upload.ts`

Responsibilities:

- Resolves asset MIME types from native asset metadata, file extension, or media kind.
- Uploads `FormData` to `/api/files`.
- Maps API upload responses into mobile `UploadedFile` objects.

### Career Special Cases

Key files:

- `apps/career/app/routes/api.resume.convert.ts`
- `apps/career/app/routes/account.tsx`

Responsibilities:

- Resume conversion stores uploaded resumes directly in `documents` storage.
- Account profile image upload stores profile images directly in `images` storage.
- These routes now use `@hominem/storage` directly; the deleted `apps/career/app/lib/services/storage.service.ts` wrapper was unnecessary.

## Good Boundaries

### Storage Package Owns Generic Storage Logic

Good:

```ts
import { createStorageService, resolveUploadMimeType, validateFile } from '@hominem/storage';

const resumeStorage = createStorageService('documents', {
  maxFileSize: 10 * 1024 * 1024,
  isPublic: false,
});
```

Why this is good:

- The consumer imports values from their original source.
- Generic MIME/size validation lives in the storage package.
- The app route owns only its app-specific policy.

### App Routes Own App-Specific Policy

Good:

```ts
const PDF_RESUME_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024,
  allowedTypes: ['application/pdf'],
} as const;

const validation = validateFile(file, PDF_RESUME_VALIDATION);
```

Why this is good:

- Resume upload policy is local to the resume upload route.
- The generic validator remains reusable.
- There is no fake global `FILE_VALIDATION_PRESETS` layer that makes ownership unclear.

## Bad Patterns Found

### 1. Thin App-Level Storage Wrappers

Bad:

```ts
// apps/career/app/lib/services/storage.service.ts
export async function uploadFile(
  file: File | Blob,
  userId: string,
  category: CareerStorageCategory,
  originalName?: string,
  mimetypeOverride?: string,
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storageServices[category].storeFile(buffer, mimetype, userId, {
    originalName: name,
  });

  return {
    success: true,
    fileId: stored.id,
    publicUrl: stored.url,
  };
}
```

Why this is bad:

- It hides the real dependency.
- It invents a second result type for no strong reason.
- It encourages re-exporting generic helpers from the wrong module.
- Tests end up mocking the wrapper instead of the actual storage dependency.

Good:

```ts
const buffer = Buffer.from(await file.arrayBuffer());
const stored = await resumeStorage.storeFile(buffer, uploadMimeType, user.id, {
  originalName: file.name,
});
```

### 2. Re-Exporting Values From the Wrong Source

Bad:

```ts
// career storage.service.ts
import { resolveUploadMimeType, validateFile } from '@hominem/storage';

export { resolveUploadMimeType, validateFile };
```

Bad consumer:

```ts
import { resolveUploadMimeType, validateFile } from '../lib/services/storage.service';
```

Why this is bad:

- It makes career look like it owns storage policy.
- It creates import drift.
- It makes future refactors harder because ownership is hidden.

Good:

```ts
import { resolveUploadMimeType, validateFile } from '@hominem/storage';
```

### 3. Trusting Client-Provided MIME Metadata

Current risk:

```ts
const parsed = uploadMetadataSchema.safeParse({
  originalName: typeof body.originalName === 'string' ? body.originalName : file.name,
  mimetype: typeof body.mimetype === 'string' ? body.mimetype : file.type,
});

const storedFile = await fileStorageService.storeFile(
  fileBuffer,
  parsed.data.mimetype,
  userId,
  { originalName: parsed.data.originalName },
);
```

Why this is risky:

- `body.mimetype` is client-controlled.
- The server can store content under a misleading MIME type.
- Downstream file processing depends on MIME type to choose image/document/audio/video behavior.

Better:

```ts
const originalName =
  typeof body.originalName === 'string' && body.originalName.trim()
    ? body.originalName
    : file.name;

const mimetype = resolveUploadMimeType({
  name: originalName,
  size: file.size,
  type: file.type,
});

const validation = validateFile(
  { name: originalName, size: file.size, type: mimetype },
  {
    maxSizeBytes: UPLOAD_MAX_FILE_SIZE_BYTES,
    allowedTypes: UPLOAD_ALLOWED_MIME_TYPES,
  },
);

if (!validation.valid) {
  throw new ValidationError(validation.error ?? 'Invalid file');
}
```

### 4. Object Storage Before DB Write Without Cleanup

Current risk:

```ts
const storedFile = await fileStorageService.storeFile(fileBuffer, mimetype, userId, {
  originalName,
});

const stored = await FileRepository.upsert(getDb(), {
  id: storedFile.id,
  userId,
  storageKey: storedFile.filename,
  originalName,
  mimetype,
  size: fileBuffer.byteLength,
  url: storedFile.url,
});
```

Why this is risky:

- If the DB upsert fails, the object remains in storage without a DB record.
- If queue enqueue fails after the DB write, processing never happens but the upload appears successful.

Better:

```ts
const storedFile = await fileStorageService.storeFile(fileBuffer, mimetype, userId, {
  originalName,
});

try {
  const stored = await FileRepository.upsert(getDb(), {
    id: storedFile.id,
    userId,
    storageKey: storedFile.filename,
    originalName,
    mimetype,
    size: fileBuffer.byteLength,
    url: storedFile.url,
  });

  await fileProcessingQueue.add('process-file', {
    fileId: storedFile.id,
    userId,
    storageKey: storedFile.filename,
    url: storedFile.url,
    originalName,
    mimetype,
    size: fileBuffer.byteLength,
  });

  return stored;
} catch (error) {
  await fileStorageService.deleteFile(storedFile.id, userId).catch((cleanupError) => {
    logger.error('[files] upload cleanup failed', {
      fileId: storedFile.id,
      userId,
      error: cleanupError,
    });
  });

  throw error;
}
```

### 5. Delete Ordering Can Leave Broken Records

Current risk:

```ts
await fileStorageService.deleteFile(fileId, userId);
await FileRepository.delete(db, fileId, userId);
```

Why this is risky:

- If storage deletion succeeds and DB deletion fails, the DB points to a missing object.
- If storage deletion fails silently, the DB record may still be deleted depending on implementation changes.

Better options:

Option A: DB-first with async cleanup:

```ts
await FileRepository.delete(db, fileId, userId);

const deleted = await fileStorageService.deleteFile(fileId, userId);
if (!deleted) {
  logger.warn('[files] storage object missing during delete', { fileId, userId });
}
```

Option B: keep a durable deletion job:

```ts
await FileRepository.markDeleting(db, fileId, userId);
await fileDeletionQueue.add('delete-file-object', { fileId, userId });
```

Option B is better when storage deletion reliability matters.

### 6. URL Endpoint May Return Unsigned URLs With Fake Expiration

Current risk:

```ts
const url = await FileRepository.getUrl(getDb(), fileId, userId);

return c.json({
  url,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
```

Why this is risky:

- The returned URL is whatever was persisted.
- `expiresAt` implies a signed URL, but the code is not creating one.
- If files are private, this endpoint may be semantically wrong.

Better:

```ts
const file = await FileRepository.getOwnedOrThrow(getDb(), fileId, userId);
const url = await fileStorageService.getSignedUrl(file.storageKey);

return c.json({
  url,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
});
```

This requires exposing `storageKey` in the repository record or adding a repository method that returns it.

### 7. Duplicate Upload Response Mapping

Bad:

```ts
// apps/web/app/lib/hooks/use-file-upload.ts
function toUploadedFile(file: ReturnType<typeof UploadResponseSchema.parse>['file']) {
  return {
    id: file.id,
    originalName: file.originalName,
    type: file.type,
    mimetype: file.mimetype,
    size: file.size,
    url: file.url,
    uploadedAt: new Date(file.uploadedAt),
    vectorIds: file.vectorIds ?? [],
  };
}
```

Same shape also exists in mobile.

Why this is bad:

- Mapping logic can drift between web and mobile.
- Optional fields such as `thumbnail`, `metadata`, `content`, and `textContent` must be remembered in multiple places.

Better:

```ts
// shared upload client package
export function toUploadedFile(file: UploadResponse['file']): UploadedFile {
  return {
    id: file.id,
    originalName: file.originalName,
    type: file.type,
    mimetype: file.mimetype,
    size: file.size,
    ...(file.content ? { content: file.content } : {}),
    ...(file.textContent ? { textContent: file.textContent } : {}),
    ...(file.metadata ? { metadata: file.metadata } : {}),
    ...(file.thumbnail ? { thumbnail: file.thumbnail } : {}),
    url: file.url,
    uploadedAt: new Date(file.uploadedAt),
    vectorIds: file.vectorIds ?? [],
  };
}
```

Then web/mobile import the shared mapper.

### 8. Prepared Upload Code Exists Without an API Surface

Current state:

```ts
async createPreparedUpload(input, userId, expiresIn = 900): Promise<PreparedUpload> {
  // implemented in storage
}
```

Why this is suspicious:

- The storage package has prepared-upload support.
- No route appears to expose it.
- Active clients use multipart `/api/files` instead.

Good options:

Option A: expose prepared uploads:

```ts
POST /api/files/prepare
PUT  signed uploadUrl
POST /api/files/:id/complete
```

Option B: delete/quarantine the prepared upload path until needed.

The important thing is to avoid a half-supported upload path that future engineers assume works end to end.

## Recommended Cleanup Plan

1. Harden `services/api/src/rpc/routes/files.ts`.
   - Normalize MIME on the server.
   - Validate file size and MIME with `@hominem/storage`.
   - Clean up object storage if DB upsert or queue enqueue fails.
   - Revisit delete ordering.

2. Decide URL semantics.
   - If file URLs are public, remove fake `expiresAt`.
   - If file URLs are private, return real signed URLs using storage keys.

3. Rename or clarify `fileStorageService`.
   - It currently uses storage category `chats`.
   - Either rename it to `chatFileStorageService` or create a true `files` category if this API is general-purpose.

4. Share upload client mapping.
   - Move `toUploadedFile` into a shared package used by web and mobile.

5. Decide prepared-upload fate.
   - Expose a full API flow or quarantine/delete the unused path.

6. Add integration tests.
   - Upload success stores object, DB record, and queue job.
   - DB failure after object storage deletes the object.
   - Queue failure after DB write has defined behavior.
   - Delete failure modes do not produce broken user-visible state.
   - Server rejects spoofed MIME metadata.

## Rule of Thumb

Good storage code has clear ownership:

- `@hominem/storage` owns storage mechanics and generic upload policy.
- API routes own endpoint-specific validation and response semantics.
- DB repositories own metadata persistence.
- Workers own post-upload processing.
- Apps should not create thin wrappers that rename storage behavior without adding real policy.
