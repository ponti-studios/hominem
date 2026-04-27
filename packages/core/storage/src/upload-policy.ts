export const UPLOAD_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'text/csv',
  'application/csv',
] as const;

export const UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_MAX_FILE_COUNT = 5;

export function isSupportedUploadMimeType(mimetype: string): boolean {
  return UPLOAD_ALLOWED_MIME_TYPES.includes(mimetype as (typeof UPLOAD_ALLOWED_MIME_TYPES)[number]);
}

export const CHAT_UPLOAD_ALLOWED_MIME_TYPES = UPLOAD_ALLOWED_MIME_TYPES;
export const CHAT_UPLOAD_MAX_FILE_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE_BYTES;
export const CHAT_UPLOAD_MAX_FILE_COUNT = UPLOAD_MAX_FILE_COUNT;
export const isSupportedChatUploadMimeType = isSupportedUploadMimeType;
