import type { UploadedFile } from '@hominem/ui/types/upload';
import {
  CHAT_UPLOAD_MAX_FILE_COUNT,
  CHAT_UPLOAD_MAX_FILE_SIZE_BYTES,
  isSupportedChatUploadMimeType,
} from '@hominem/utils/upload';
import { useCallback, useState } from 'react';
import * as z from 'zod';

import { API_BASE_URL } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';

interface UploadClient {
  upload(formData: FormData): Promise<{
    success: boolean;
    file: {
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
    };
  }>;
}

const MobileUploadedFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string().min(1),
  type: z.enum(['image', 'document', 'audio', 'video', 'unknown']),
  mimetype: z.string().min(1),
  size: z.number().nonnegative(),
  content: z.string().optional(),
  textContent: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  thumbnail: z.string().optional(),
  url: z.string().min(1),
  uploadedAt: z.string(),
  vectorIds: z.array(z.string()).optional(),
});

const MobileUploadResponseSchema = z.object({
  success: z.literal(true),
  file: MobileUploadedFileSchema,
});

function toUploadedFile(file: z.infer<typeof MobileUploadedFileSchema>): UploadedFile {
  return {
    id: file.id,
    originalName: file.originalName,
    type: file.type,
    mimetype: file.mimetype,
    size: file.size,
    ...(file.content ? { content: file.content } : {}),
    ...(file.textContent ? { textContent: file.textContent } : {}),
    ...(file.metadata ? { metadata: file.metadata } : {}),
    ...(file.thumbnail ? { thumbnail: file.thumbnail } : {}),
    url: file.url,
    uploadedAt: new Date(file.uploadedAt),
    vectorIds: file.vectorIds ?? [],
  };
}

export interface MobileUploadAsset {
  assetId: string;
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  type: string | null;
}

export interface MobileUploadedAsset {
  assetId: string;
  localUri: string;
  uploadedFile: UploadedFile;
}

export interface MobileUploadState {
  isUploading: boolean;
  progress: number;
  errors: string[];
}

export interface MobileUploadBatchResult {
  uploaded: MobileUploadedAsset[];
  errors: string[];
}

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  png: 'image/png',
  txt: 'text/plain',
  wav: 'audio/wav',
  webm: 'video/webm',
  webp: 'image/webp',
};

function getFallbackFileName(uri: string): string {
  return uri.split('/').pop() ?? 'attachment';
}

export function resolveMobileUploadMimeType(asset: MobileUploadAsset): string {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const fileName = asset.fileName ?? getFallbackFileName(asset.uri);
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension && MIME_TYPE_BY_EXTENSION[extension]) {
    return MIME_TYPE_BY_EXTENSION[extension];
  }

  if (asset.type === 'image') return 'image/jpeg';
  if (asset.type === 'audio') return 'audio/mpeg';
  if (asset.type === 'video') return 'video/mp4';

  return 'application/octet-stream';
}

async function readLocalAssetBlob(
  fetchImpl: typeof fetch,
  asset: MobileUploadAsset,
): Promise<Blob> {
  const response = await fetchImpl(asset.uri);

  return response.blob();
}

export async function performMobileUploads(
  api: UploadClient,
  assets: MobileUploadAsset[],
  options?: {
    fetchImpl?: typeof fetch;
    onProgress?: (progress: number) => void;
  },
): Promise<MobileUploadBatchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const uploaded: MobileUploadedAsset[] = [];
  const errors: string[] = [];

  for (const [index, asset] of assets.entries()) {
    const originalName = asset.fileName ?? getFallbackFileName(asset.uri);

    try {
      const mimetype = resolveMobileUploadMimeType(asset);
      if (!isSupportedChatUploadMimeType(mimetype)) {
        throw new Error('Unsupported file type');
      }

      const fileBlob = await readLocalAssetBlob(fetchImpl, asset);
      if (fileBlob.size > CHAT_UPLOAD_MAX_FILE_SIZE_BYTES) {
        throw new Error('File exceeds 10MB limit');
      }

      const formData = new FormData();
      formData.append('file', fileBlob, originalName);
      formData.append('originalName', originalName);
      formData.append('mimetype', mimetype);

      const completion = MobileUploadResponseSchema.parse(await api.upload(formData));

      uploaded.push({
        assetId: asset.assetId,
        localUri: asset.uri,
        uploadedFile: toUploadedFile(completion.file),
      });
    } catch (error) {
      errors.push(`${originalName}: ${error instanceof Error ? error.message : 'Upload failed'}`);
    } finally {
      options?.onProgress?.(Math.round(((index + 1) / assets.length) * 100));
    }
  }

  return {
    uploaded,
    errors,
  };
}

export function useFileUpload() {
  const { getAuthHeaders } = useAuth();
  const [uploadState, setUploadState] = useState<MobileUploadState>({
    isUploading: false,
    progress: 0,
    errors: [],
  });

  const uploadAssets = useCallback(
    async (assets: MobileUploadAsset[]): Promise<MobileUploadedAsset[]> => {
      if (assets.length === 0) {
        return [];
      }

      if (assets.length > CHAT_UPLOAD_MAX_FILE_COUNT) {
        const error = `You can upload up to ${CHAT_UPLOAD_MAX_FILE_COUNT} files at a time`;
        setUploadState({
          isUploading: false,
          progress: 0,
          errors: [error],
        });
        return [];
      }

      setUploadState({
        isUploading: true,
        progress: 0,
        errors: [],
      });

      const result = await performMobileUploads(
        {
          upload: async (formData) => {
            const authHeaders = await getAuthHeaders();
            const response = await fetch(`${API_BASE_URL}/api/files`, {
              method: 'POST',
              headers: {
                ...authHeaders,
                Accept: 'application/json',
              },
              body: formData,
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({}));
              throw new Error(
                typeof error.message === 'string' ? error.message : `Upload failed (${response.status})`,
              );
            }

            return response.json();
          },
        },
        assets,
        {
          onProgress: (progress) => {
            setUploadState((currentState) => ({
              ...currentState,
              progress,
            }));
          },
        },
      );

      setUploadState({
        isUploading: false,
        progress: result.uploaded.length > 0 || result.errors.length > 0 ? 100 : 0,
        errors: result.errors,
      });

      return result.uploaded;
    },
    [getAuthHeaders],
  );

  const clearErrors = useCallback(() => {
    setUploadState((currentState) => ({
      ...currentState,
      errors: [],
    }));
  }, []);

  return {
    uploadState,
    uploadAssets,
    clearErrors,
  };
}
