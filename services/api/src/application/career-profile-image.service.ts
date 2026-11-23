import { CareerRepository } from '@hominem/db/career';
import { db } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { imageStorageService, validateFile } from '@hominem/storage';

const PROFILE_IMAGE_VALIDATION = {
  maxSizeBytes: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

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
