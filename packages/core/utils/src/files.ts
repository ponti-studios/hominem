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
