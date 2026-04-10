import type { RawHonoClient } from '../core/raw-client';

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
