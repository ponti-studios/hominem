# Composer: Attachments

## Entry points

Attachments are added via two paths, both triggered by the `plus` button in the accessory row.

The `plus` button shows an `ActionSheetIOS` with three options:

```ts
ActionSheetIOS.showActionSheetWithOptions(
  { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
  (buttonIndex) => {
    if (buttonIndex === 1) setIsCameraOpen(true);     // → CameraModal
    else if (buttonIndex === 2) void pickAttachment(); // → ImagePicker
  }
);
```

## Photo library picker

`pickAttachment` in `useComposerMediaActions.ts`:

```ts
const result = await ImagePicker.launchImageLibraryAsync({
  allowsMultipleSelection: true,
  mediaTypes: 'images',
  quality: 0.8,
});
```

- Multi-select enabled
- Images only (`mediaTypes: 'images'`)
- 80% quality
- Respects `CHAT_UPLOAD_MAX_FILE_COUNT` — an alert fires if the selected count would exceed the limit

## Camera modal

`CameraModal` renders inside a `BottomSheetModal`. It uses `react-native-vision-camera` with:

- Back and front camera support via `useCameraDevice(facing)`
- `takePhoto()` on the `Camera` ref
- `expo-haptics` medium impact on capture
- Optional save-to-camera-roll prompt (if `MediaLibrary` permission is granted)
- Permission request flow if camera access has not been granted

After capture, `handleCameraCapture` is called with `{ uri, fileName }`.

## Upload pipeline

Both paths ultimately call `appendUploadedAssets` in `useComposerMediaActions.ts`, which delegates to `uploadAssets` from `useFileUpload`.

### `performMobileUploads` (`use-file-upload.ts`)

Files are uploaded sequentially in a `for...of` loop:

1. Resolve MIME type from `asset.mimeType`, filename extension, or type field
2. Validate MIME type is in the supported list (`isSupportedChatUploadMimeType`)
3. Read local file blob via `fetch(asset.uri).blob()`
4. Check file size ≤ `CHAT_UPLOAD_MAX_FILE_SIZE_BYTES` (10MB)
5. Build `FormData` with `file`, `originalName`, `mimetype`
6. `POST /api/files` with auth headers
7. Parse response with `parseUploadResponse`
8. Report progress after each file via `onProgress` callback

### MIME resolution order

1. `asset.mimeType` (provided by ImagePicker)
2. File extension looked up in `MIME_TYPE_BY_EXTENSION`
3. Type fallback: `'image'` → `image/jpeg`, `'audio'` → `audio/mpeg`, `'video'` → `video/mp4`
4. Default: `application/octet-stream`

Camera captures are hardcoded to `mimeType: 'image/jpeg'`.

### Upload state

`useFileUpload` tracks upload state in local React state:

```ts
interface MobileUploadState {
  isUploading: boolean;
  progress: number;   // 0–100, updated per file
  errors: string[];
}
```

`isUploading` blocks the send button (`canSubmit` is false while uploading). Errors are shown as a concatenated string below the thumbnail strip.

## Attachment rendering

`ComposerAttachments` renders a horizontal `ScrollView` of thumbnails:

```
[thumbnail] [thumbnail] [thumbnail]
```

Each thumbnail:
- `spacing[4] * 3` × `spacing[4] * 3` (48px × 48px)
- `expo-image` `Image` with `contentFit="cover"`
- `xmark` badge overlaid at top-right
- Semi-transparent dim overlay while `isUploading`

Tapping a thumbnail calls `handleRemoveAttachment(a.id)`.

## Removing an attachment

`handleRemoveAttachment` in `useComposerSubmission.ts`:

1. Removes the attachment from `attachments` state immediately (optimistic)
2. If the attachment has a `uploadedFile.id`, calls `DELETE /api/files/:fileId` fire-and-forget with `.catch(() => undefined)`

## Limits

| Constraint | Value | Source |
|---|---|---|
| Max files per upload | `CHAT_UPLOAD_MAX_FILE_COUNT` | `@hakumi/utils/upload` |
| Max file size | 10MB (`CHAT_UPLOAD_MAX_FILE_SIZE_BYTES`) | `@hakumi/utils/upload` |
| Supported MIME types | checked via `isSupportedChatUploadMimeType` | `@hakumi/utils/upload` |
