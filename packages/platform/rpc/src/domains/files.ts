import type { RawHonoClient } from '../core/raw-client';

export interface FilePrepareUploadInput {
  originalName: string;
  mimetype: string;
  size: number;
}

export interface FilePrepareUploadOutput {
  fileId: string;
  key: string;
  originalName: string;
  mimetype: string;
  size: number;
  uploadUrl: string;
  headers: Record<string, string>;
  url: string;
  uploadedAt: string;
  expiresAt: string;
}

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

export interface FileDeleteInput {
  fileId: string;
}

export interface FileDeleteOutput {
  success: boolean;
  message: string;
}

export interface FilesClient {
  prepareUpload(input: FilePrepareUploadInput): Promise<FilePrepareUploadOutput>;
  completeUpload(input: FileCompleteUploadInput): Promise<FileCompleteUploadOutput>;
  delete(input: FileDeleteInput): Promise<FileDeleteOutput>;
}

export function createFilesClient(rawClient: RawHonoClient): FilesClient {
  return {
    async prepareUpload(input) {
      const res = await rawClient.api.files['prepare-upload'].$post({ json: input });
      return res.json() as Promise<FilePrepareUploadOutput>;
    },
    async completeUpload(input) {
      const res = await rawClient.api.files['complete-upload'].$post({ json: input });
      return res.json() as Promise<FileCompleteUploadOutput>;
    },
    async delete(input) {
      const res = await rawClient.api.files[':fileId'].$delete({
        param: { fileId: input.fileId },
      });
      return res.json() as Promise<FileDeleteOutput>;
    },
  };
}
