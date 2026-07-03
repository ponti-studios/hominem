export const STORAGE_ERROR_CODES = [
  'storage.config.missing',
  'storage.credentials.invalid',
  'storage.bucket.access_denied',
  'storage.bucket.missing',
  'storage.network.unreachable',
  'storage.bucket.access_unknown',
] as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

const STORAGE_ERROR_CODE_SET: ReadonlySet<StorageErrorCode> = new Set(STORAGE_ERROR_CODES);

export class StorageServiceError extends Error {
  public readonly code: StorageErrorCode;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(code: StorageErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, StorageServiceError.prototype);
    this.name = 'StorageServiceError';
  }
}

export function isStorageServiceError(value: unknown): value is StorageServiceError {
  if (value instanceof StorageServiceError) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    code?: string;
    message?: string;
    details?: Record<string, unknown> | undefined;
  };

  return (
    typeof candidate.code === 'string' &&
    STORAGE_ERROR_CODE_SET.has(candidate.code as StorageErrorCode) &&
    typeof candidate.message === 'string'
  );
}
