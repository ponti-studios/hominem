export {
  csvStorageService,
  fileStorageService,
  placeImagesStorageService,
  R2StorageService,
} from './r2-storage';

export type {
  FileObject,
  PreparedUpload,
  StorageOptions,
  StoredFile,
  TestStorageService,
} from './types';

/**
 * Whether the application is running in test mode.
 * Used to enable test-only features and optimize test performance.
 * Evaluated at call time (not module load time) to support environments
 * where NODE_ENV is set after module initialization.
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}
