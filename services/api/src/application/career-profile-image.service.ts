import { CareerRepository } from '@hominem/db/career';
import { db } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { imageStorageService, isStorageServiceError, validateFile } from '@hominem/storage';

const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

export function profileImageUploadError(error: unknown): string {
  if (!isStorageServiceError(error)) {
    return error instanceof Error ? error.message : 'Failed to upload image';
  }

  switch (error.code) {
    case 'storage.config.missing':
      return 'Profile image storage is not configured yet.';
    case 'storage.credentials.invalid':
      return 'Profile image storage credentials were rejected.';
    case 'storage.bucket.access_denied':
      return 'Profile image storage access was denied.';
    case 'storage.bucket.missing':
      return 'Profile image storage bucket was not found.';
    case 'storage.network.unreachable':
      return 'Profile image storage is temporarily unreachable.';
    default:
      return 'Failed to upload image';
  }
}

export async function uploadCareerProfileImage(ownerUserId: string, file: File) {
  const validation = validateFile(file, PROFILE_IMAGE_VALIDATION);
  if (!validation.valid) {
    throw new ValidationError(validation.error ?? 'Invalid image');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await imageStorageService.storeFile(buffer, file.type, ownerUserId, {
    originalName: file.name,
  });

  try {
    await CareerRepository.updateProfileImage(db, ownerUserId, stored.url);
  } catch (error) {
    await imageStorageService.deleteFile(stored.id, ownerUserId);
    throw error;
  }

  return { imageUrl: stored.url };
}
