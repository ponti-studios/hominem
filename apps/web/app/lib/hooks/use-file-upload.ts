import { isTestMode } from '@hominem/utils/storage';
import {
  CHAT_UPLOAD_ALLOWED_MIME_TYPES,
  CHAT_UPLOAD_MAX_FILE_COUNT,
  CHAT_UPLOAD_MAX_FILE_SIZE_BYTES,
} from '@hominem/utils/upload';
// Lazy load Uppy types only for type checking
import type { Body, Meta, UppyFile } from '@uppy/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as z from 'zod';

import type { UploadedFile } from '~/lib/types/upload';

/**
 * Upload state machine states.
 * Transitions: idle → uploading → done
 * Error can transition from any non-terminal state.
 */
export type UploadStateMachine = 'idle' | 'uploading' | 'done' | 'error';

const UploadedFileSchema = z.object({
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

const UploadResponseSchema = z.object({
  success: z.literal(true),
  file: UploadedFileSchema,
  message: z.string().min(1),
});

type UploadResponse = z.infer<typeof UploadResponseSchema>;

function toUploadedFile(file: UploadResponse['file']): UploadedFile {
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

interface UploadState {
  /** Current state in the upload state machine */
  state: UploadStateMachine;
  /** Whether an upload is currently in progress (state is uploading) */
  isUploading: boolean;
  /** Upload progress percentage (0-100) */
  progress: number;
  /** Files that have been successfully uploaded */
  uploadedFiles: UploadedFile[];
  /** Error messages from failed uploads */
  errors: string[];
}

interface UseFileUploadReturn {
  uploadState: UploadState;
  uploadFiles: (files: FileList | File[]) => Promise<UploadedFile[]>;
  removeFile: (fileId: string) => void;
  clearAll: () => void;
}

// Lazy load Uppy modules to avoid bundling on initial page load
async function loadUppyModules() {
  const [{ default: Uppy }, { default: XHRUpload }] = await Promise.all([
    import('@uppy/core'),
    import('@uppy/xhr-upload'),
  ]);
  return { Uppy, XHRUpload };
}

export function useFileUpload(): UseFileUploadReturn {
  const [uploadState, setUploadState] = useState<UploadState>({
    state: 'idle',
    isUploading: false,
    progress: 0,
    uploadedFiles: [],
    errors: [],
  });
  const uppyRef = useRef<InstanceType<Awaited<ReturnType<typeof loadUppyModules>>['Uppy']> | null>(
    null,
  );
  const uppyPromiseRef = useRef<ReturnType<typeof loadUppyModules> | null>(null);

  // Pre-load Uppy modules in test mode for deterministic behavior
  useEffect(() => {
    if (isTestMode() && !uppyPromiseRef.current) {
      uppyPromiseRef.current = loadUppyModules();
    }
  }, []);

  const getUppy = useCallback(async () => {
    if (uppyRef.current) {
      return uppyRef.current;
    }

    if (!uppyPromiseRef.current) {
      uppyPromiseRef.current = loadUppyModules();
    }

    const { Uppy, XHRUpload } = await uppyPromiseRef.current;

    const uppy = new Uppy<Meta, Body>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: {
        allowedFileTypes: [...CHAT_UPLOAD_ALLOWED_MIME_TYPES],
        maxFileSize: CHAT_UPLOAD_MAX_FILE_SIZE_BYTES,
        maxNumberOfFiles: CHAT_UPLOAD_MAX_FILE_COUNT,
      },
    });

    uppy.use(XHRUpload, {
      endpoint: `${import.meta.env.VITE_PUBLIC_API_URL}/api/files`,
      method: 'POST',
      formData: true,
      fieldName: 'file',
      withCredentials: true,
      headers: () => ({
        Accept: 'application/json',
      }),
      allowedMetaFields: ['originalName', 'mimetype'],
      getResponseData(xhr: XMLHttpRequest) {
        const parsed = UploadResponseSchema.safeParse(JSON.parse(xhr.responseText));
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message ?? 'Invalid upload response');
        }
        return parsed.data;
      },
    });

    uppy.on('file-added', (file) => {
      uppy.setFileMeta(file.id, {
        originalName: file.name ?? 'file',
        mimetype: file.type || 'application/octet-stream',
      });
    });

    uppy.on('progress', (progress: number) => {
      setUploadState((prev) => ({
        ...prev,
        progress,
      }));
    });

    uppy.on('restriction-failed', (file: UppyFile<Meta, Body> | undefined, error: Error) => {
      const message = file ? `${file.name}: ${error.message}` : error.message;
      setUploadState((prev) => ({
        ...prev,
        errors: [...prev.errors, message],
      }));
    });

    uppyRef.current = uppy;
    return uppy;
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | File[]): Promise<UploadedFile[]> => {
      const fileArray = Array.from(files);

      setUploadState((prev) => ({
        ...prev,
        state: 'uploading',
        isUploading: true,
        progress: 0,
        errors: [],
      }));

      try {
        const uppy = await getUppy();

        for (const file of fileArray) {
          uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
          });
        }

        const result = await uppy.upload();
        const newFiles = (result?.successful ?? []).flatMap((file) => {
          const body = file.response?.body;
          const parsed = UploadResponseSchema.safeParse(body);
          if (!parsed.success) {
            return [];
          }
          return [toUploadedFile(parsed.data.file)];
        });

        const uploadErrors = (result?.failed ?? []).map((failedFile) => {
          const errorMessage =
            typeof failedFile.error === 'string'
              ? failedFile.error
              : String(failedFile.error ?? 'Upload failed');
          return `${failedFile.name}: ${errorMessage}`;
        });

        setUploadState((prev) => ({
          ...prev,
          state: uploadErrors.length > 0 ? 'error' : 'done',
          isUploading: false,
          progress: 100,
          uploadedFiles: [...prev.uploadedFiles, ...newFiles],
          errors: uploadErrors,
        }));

        uppy.clear();

        return newFiles;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';

        setUploadState((prev) => ({
          ...prev,
          state: 'error',
          isUploading: false,
          progress: 0,
          errors: [errorMessage],
        }));

        throw error;
      }
    },
    [getUppy],
  );

  const removeFile = useCallback((fileId: string) => {
    setUploadState((prev) => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((file) => file.id !== fileId),
    }));
  }, []);

  const clearAll = useCallback(async () => {
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
      uppyRef.current.clear();
    }

    setUploadState({
      state: 'idle',
      isUploading: false,
      progress: 0,
      uploadedFiles: [],
      errors: [],
    });
  }, []);

  return {
    uploadState,
    uploadFiles,
    removeFile,
    clearAll,
  };
}
