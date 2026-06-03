import { createStorageService } from '@hominem/storage';

export type CareerStorageCategory = 'profile-images' | 'resumes' | 'documents';

const storageServices: Record<CareerStorageCategory, ReturnType<typeof createStorageService>> = {
  'profile-images': createStorageService('images', {
    maxFileSize: 5 * 1024 * 1024,
    isPublic: true,
  }),
  resumes: createStorageService('documents', { maxFileSize: 10 * 1024 * 1024, isPublic: false }),
  documents: createStorageService('documents', { maxFileSize: 25 * 1024 * 1024, isPublic: false }),
};

export interface UploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  error?: string;
}

export async function uploadFile(
  file: File | Blob,
  userId: string,
  category: CareerStorageCategory,
  originalName?: string,
  mimetypeOverride?: string,
): Promise<UploadResult> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimetype = mimetypeOverride || file.type || 'application/octet-stream';
    const name = file instanceof File ? file.name : (originalName ?? 'file');

    const stored = await storageServices[category].storeFile(buffer, mimetype, userId, {
      originalName: name,
    });

    return {
      success: true,
      fileId: stored.id,
      publicUrl: stored.url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

export async function deleteFile(
  fileId: string,
  userId: string,
  category: CareerStorageCategory,
): Promise<{ success: boolean; error?: string }> {
  try {
    const deleted = await storageServices[category].deleteFile(fileId, userId);
    return deleted ? { success: true } : { success: false, error: 'File not found' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

export function validateFile(
  file: File,
  options: { maxSizeBytes: number; allowedTypes: readonly string[] },
): { valid: boolean; error?: string } {
  if (file.size > options.maxSizeBytes) {
    const maxSizeMB = options.maxSizeBytes / (1024 * 1024);
    return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }
  if (!isAllowedFileType(file, options.allowedTypes)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
    };
  }
  return { valid: true };
}

export function isAllowedFileType(file: File, allowedTypes: readonly string[]): boolean {
  if (allowedTypes.includes(file.type)) return true;

  return (
    !file.type &&
    allowedTypes.includes('application/pdf') &&
    file.name.toLowerCase().endsWith('.pdf')
  );
}

export function resolveUploadMimeType(file: File, fallbackMimeType = 'application/pdf'): string {
  return file.type || (file.name.toLowerCase().endsWith('.pdf') ? fallbackMimeType : '');
}

export const FILE_VALIDATION_PRESETS = {
  PDF_RESUME: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedTypes: ['application/pdf'],
  },
  PROFILE_IMAGE: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  DOCUMENT: {
    maxSizeBytes: 25 * 1024 * 1024,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },
} as const;
