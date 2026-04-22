# Journal

- 2026-04-18T06:24:23Z: Created work item `native-upload-lifecycle-and-failure-recovery`.
- 2026-04-19T00:00:00Z: Created `FileUploadService` (`@Observable @MainActor final class`): `POST /api/files` multipart/form-data with `file`, `originalName`, `mimetype` fields; 10 MB limit; 5 file max; 15 allowed MIME types matching the Expo contract. `deleteFile(id:)` calls `DELETE /api/files/:id`. Multipart body builder uses nested `append` function for clean boundary framing. Added `isUploading` signal. BUILD SUCCEEDED.
