# Storage Service

The storage service provides centralized file upload functionality for the application to ensure consistent folder structure and prevent developers from uploading files to the wrong locations.

## Usage

### Basic Upload

```typescript
import { uploadFile, validateFile, FILE_VALIDATION_PRESETS } from '../lib/services/storage.service'

// Validate file before upload
const validation = validateFile(file, FILE_VALIDATION_PRESETS.PDF_RESUME)
if (!validation.valid) {
  // Handle validation error
  console.error(validation.error)
  return
}

// Upload file
const result = await uploadFile(supabase, {
  file: file,
  userId: user.supabaseUser?.id || '',
  folder: 'resumes', // 'resumes' | 'profile-images' | 'documents'
  upsert: false, // Optional: default true
})

if (result.success) {
  // Use result.publicUrl and result.filePath
  console.log('File uploaded:', result.publicUrl)
} else {
  console.error('Upload failed:', result.error)
}
```

### File Validation Presets

- `FILE_VALIDATION_PRESETS.PDF_RESUME` - PDF files up to 10MB
- `FILE_VALIDATION_PRESETS.PROFILE_IMAGE` - Images up to 5MB
- `FILE_VALIDATION_PRESETS.DOCUMENT` - Documents up to 25MB

### Folder Structure

Files are automatically organized into a standardized structure:

```
public/
  {userId}/
    resumes/
      resume-{timestamp}-{sanitized-filename}
    profile-images/
      profile-{timestamp}.{extension}
    documents/
      doc-{timestamp}-{sanitized-filename}
```

### Delete Files

```typescript
import { deleteFile } from '../lib/services/storage.service'

const result = await deleteFile(supabase, filePath)
if (result.success) {
  console.log('File deleted successfully')
} else {
  console.error('Delete failed:', result.error)
}
```

## Benefits

1. **Consistent Structure**: All uploads follow the same folder pattern
2. **Validation**: Built-in file type and size validation
3. **Security**: Sanitized filenames prevent path traversal attacks
4. **Error Handling**: Standardized error responses
5. **Cleanup**: Helper functions for file deletion on error conditions

## Migration from Manual Uploads

Replace manual Supabase storage calls with the helper functions:

### Before:
```typescript
const fileName = `resume-${Date.now()}-${file.name}`
const filePath = `public/${userId}/${fileName}`
const { error } = await supabase.storage
  .from("crafted")
  .upload(filePath, file, { cacheControl: "3600", upsert: false })
```

### After:
```typescript
const result = await uploadFile(supabase, {
  file,
  userId,
  folder: 'resumes',
  upsert: false,
})
``` 