export {
  csvStorageService,
  fileStorageService,
  placeImagesStorageService,
  R2StorageService,
} from './r2-storage';

export type { FileObject, PreparedUpload, StorageOptions, StoredFile, TestStorageService } from './types';

/**
 * Whether the application is running in test mode.
 * Used to enable test-only features and optimize test performance.
 */
export const isTestMode = process.env.NODE_ENV === 'test';
