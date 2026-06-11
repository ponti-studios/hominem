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

export type FileType = 'image' | 'audio' | 'video' | 'document' | 'file';

export function classifyFileByMimeType(mimetype: string): FileType {
  if (!mimetype) return 'file';

  const type = mimetype.toLowerCase();

  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';

  if (
    type === 'application/pdf' ||
    type.startsWith('text/') ||
    type.includes('word') ||
    type.includes('document') ||
    type.includes('spreadsheet') ||
    type.includes('presentation') ||
    type.includes('csv') ||
    type.includes('json') ||
    type.includes('xml')
  ) {
    return 'document';
  }

  return 'file';
}

export function getmimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    heic: 'image/heic',
    heif: 'image/heif',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',

    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4',

    // Video
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',

    // Documents
    pdf: 'application/pdf',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
  };

  const normalized = extension.toLowerCase();
  return mimeMap[normalized] || 'application/octet-stream';
}
