/**
 * Shared file and MIME type utilities
 */

export type FileType = 'image' | 'audio' | 'video' | 'document' | 'file';

/**
 * Classify a file based on its MIME type.
 * Used by both web and mobile apps to consistently categorize uploads.
 *
 * @param mimetype - The file's MIME type (e.g. "image/png", "application/pdf")
 * @returns The classified file type
 *
 * @example
 * ```ts
 * classifyFileByMimeType('image/jpeg') // 'image'
 * classifyFileByMimeType('application/pdf') // 'document'
 * classifyFileByMimeType('audio/mp3') // 'audio'
 * ```
 */
export function classifyFileByMimeType(mimetype: string): FileType {
  if (!mimetype) return 'file';

  const type = mimetype.toLowerCase();

  // Image files
  if (type.startsWith('image/')) return 'image';

  // Audio files
  if (type.startsWith('audio/')) return 'audio';

  // Video files
  if (type.startsWith('video/')) return 'video';

  // Document files
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

/**
 * Map a file extension to its MIME type.
 * Handles common file extensions across images, documents, audio, and video.
 *
 * @param extension - File extension without the dot (e.g. "pdf", "jpg")
 * @returns The MIME type, or 'application/octet-stream' if unknown
 */
export function getmimeTypeFromExtension(extension: string): string {
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
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
