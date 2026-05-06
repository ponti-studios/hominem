function sanitizeFileNameInternal(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function getFileExtension(fileName: string | null | undefined): string | null {
  if (!fileName) return null;

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
}

export function sanitizeFileName(fileName: string): string {
  return sanitizeFileNameInternal(fileName);
}

export function buildStoredFileName(id: string, fileName: string, extension: string): string {
  const sanitized = sanitizeFileName(fileName);
  const withExtension = sanitized.endsWith(extension) ? sanitized : `${sanitized}${extension}`;
  return `${id}-${withExtension}`;
}

export function formatTimestampForFileName(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/csv': '.csv',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/json': '.json',
  'application/xml': '.xml',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/flac': '.flac',
  'audio/mp4': '.m4a',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
};

export function getExtensionFromMimeType(mimetype: string): string {
  return MIME_TO_EXT[mimetype.toLowerCase()] ?? '';
}
