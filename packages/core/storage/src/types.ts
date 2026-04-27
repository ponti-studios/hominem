export interface StoredFile {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface StorageOptions {
  maxFileSize?: number;
  isPublic?: boolean;
}

export interface FileObject {
  name: string;
  size: number;
  lastModified?: Date;
}

export interface PreparedUpload {
  id: string;
  key: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadUrl: string;
  headers: Record<string, string>;
  url: string;
  uploadedAt: Date;
  expiresAt: Date;
}

/**
 * Test-only storage interface for E2E test stability.
 * These methods are only available in test mode (NODE_ENV === 'test').
 */
export interface TestStorageService {
  /**
   * Store a file with an exact key path. Used by E2E tests to pre-seed files.
   * @param filePath - The exact storage key path
   * @param buffer - The file content
   */
  __testOnlyStoreFile(filePath: string, buffer: Buffer): void;
}
