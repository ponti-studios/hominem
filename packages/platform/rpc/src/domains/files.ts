import type { RawHonoClient } from '../core/raw-client';

export interface RpcUploadedFile {
  id: string;
  originalName: string;
  type: 'image' | 'document' | 'audio' | 'video' | 'unknown';
  mimetype: string;
  size: number;
  content?: string;
  textContent?: string;
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  url: string;
  uploadedAt: string;
  vectorIds?: string[];
}

export interface FileCompleteUploadInput {
  fileId: string;
  key: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface FileCompleteUploadOutput {
  success: boolean;
  file: RpcUploadedFile;
  message: string;
}

export interface FileUploadOutput extends FileCompleteUploadOutput {}

export interface FileDeleteInput {
  fileId: string;
}

export interface FileDeleteOutput {
  success: boolean;
  message: string;
}

export interface FilesClient {
  delete(input: FileDeleteInput): Promise<FileDeleteOutput>;
}

export function createFilesClient(rawClient: RawHonoClient): FilesClient {
  return {
    async delete(input) {
      const res = await rawClient.delete(`/api/files/${input.fileId}`);
      return res.json() as Promise<FileDeleteOutput>;
    },
  };
}
