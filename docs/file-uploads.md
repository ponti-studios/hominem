# Files and images (R2)

Uploads go straight from the client to R2 with a presigned PUT, and every read is a short-lived
signed GET. The bucket stays private. The API never trusts what the client says the file is.

## Upload flow

1. `POST /api/files/uploads` with `{originalName, mimetype, size}`. The API checks the type
   allowlist and the 10 MB cap, inserts a `pending` row in `app.files`, and returns a presigned
   PUT into `quarantine/users/{uid}/{uuid}`. The URL is good for 5 minutes and signs
   `content-type` and `content-length`, so the client has to send exactly what it declared.
   Rate limited per user (60/hour).
2. The client PUTs the bytes to R2. No auth header goes there, the signature is the credential.
3. `POST /api/files/uploads/:id/complete`. The API HEADs the object (real size must match), pulls
   the first 4100 bytes, and sniffs the magic number against the declared type (`file-type`). Text
   types must have no magic number and be valid UTF-8. If it passes, the object is copied to
   `users/{uid}/{category}/{uuid}` with locked headers, the quarantine copy is deleted, the row
   flips to `ready`, and the processing job is queued. If it fails, the object and the pending row
   are deleted.

Keys are server-chosen UUIDs. User-supplied names never touch a key.

Legacy `POST /api/files` (multipart) still works for old mobile builds but runs the same type,
size and sniff checks. Drop it once those builds are gone.

## Reads

Rows and chat messages keep storing the old permanent URL. On the way out, `signFileUrl` /
`signStoredUrl` turn it back into a key and sign it (5 minutes, `Cache-Control: private,
no-store`). The response content type is pinned by us, and `Content-Disposition` is `inline` only
for image/audio/video (never SVG), `attachment` for everything else. URLs that aren't ours pass
through. `GET /api/files/:id/url` returns a fresh signed URL when one has expired.

Every user-facing query filters `status = 'ready'`, so pending uploads never show up.

## Bucket setup (needs a human, touches prod)

- Remove the public domain / `r2.dev` access so the bucket is private.
- CORS rule: allow the app origins, methods `PUT` and `GET`, headers `Content-Type` and
  `Content-Length`, no wildcard origin.
- Lifecycle rule: expire `quarantine/` after 1 day, and `rejected/` after 30.
- Scope the API token to this bucket, Object Read & Write only.
- Stale `pending` rows: `app_files_pending_createdat_idx` is there for a janitor. Delete pending
  rows older than a day.

## Backfill

Old objects get the same checks before the bucket flips private:

```bash
pnpm --filter @hominem/api backfill:file-security              # dry run
pnpm --filter @hominem/api backfill:file-security -- --execute
```

It re-sniffs every ready file and rewrites headers in place (keys don't change, so stored URLs
keep working). Failures are parked under `rejected/` and the row is removed. Nothing is deleted
outright. Run it against prod through `fly proxy` with the prod `DATABASE_URL` and R2 env set.
