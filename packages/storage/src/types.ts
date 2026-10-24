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

// Where a direct-to-R2 upload lands before we have looked at its bytes. Nothing under this
// prefix is ever served; a bucket lifecycle rule also expires it.
export interface UploadIntent {
  id: string;
  quarantineKey: string;
  uploadUrl: string;
  // Signed into the URL. The client must send these exactly or R2 rejects the PUT.
  headers: Record<string, string>;
  expiresAt: Date;
}

export type FinalizeResult =
  | { ok: true; key: string; size: number }
  | {
      ok: false;
      reason: 'missing' | 'size_mismatch' | 'too_large' | 'content_rejected' | 'changed';
      detail?: string;
    };

// Result of re-checking an object that was stored before direct uploads existed.
export type ReverifyResult =
  | { ok: true; size: number }
  | { ok: false; reason: 'missing' | 'too_large' | 'content_rejected'; detail?: string };
