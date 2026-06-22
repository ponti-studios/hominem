// ============================================================================
// File Processing Types
// ============================================================================

/**
 * Processed file from server-side file processing
 */
interface ProcessedFile {
  id: string;
  originalName: string;
  type: 'image' | 'document' | 'audio' | 'video' | 'unknown';
  mimetype: string;
  size: number;
  content?: string;
  textContent?: string;
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  duration?: number;
  transcription?: string;
}

/**
 * Successfully uploaded file (API response)
 */
export interface UploadedFile extends ProcessedFile {
  url: string;
  uploadedAt: Date;
  vectorIds?: string[];
}
