import { useApiClient } from '@hominem/rpc/react';
import { isTestMode } from '@hominem/utils/storage';
import {
  CHAT_UPLOAD_ALLOWED_MIME_TYPES,
  CHAT_UPLOAD_MAX_FILE_COUNT,
  CHAT_UPLOAD_MAX_FILE_SIZE_BYTES,
} from '@hominem/utils/upload';
// Lazy load Uppy types only for type checking
import type { Body, Meta, UppyFile } from '@uppy/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { UploadedFile } from '~/lib/types/upload';

/**
 * Upload state machine states.
 * Transitions: idle → preparing → uploading → completing → done
 * Error can transition from any non-terminal state.
 */
export type UploadStateMachine = 'idle' | 'preparing' | 'uploading' | 'completing' | 'done' | 'error';

interface UploadFileMeta extends Meta {
  fileId?: string;
  key?: string;
  originalName?: string;
  mimetype?: string;
  size?: number;
}

type UploadFileBody = Body;

interface UploadState {
  /** Current state in the upload state machine */
  state: UploadStateMachine;
  /** Whether an upload is currently in progress (state is preparing, uploading, or completing) */
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
  const [{ default: Uppy }, { default: AwsS3 }] = await Promise.all([
    import('@uppy/core'),
    import('@uppy/aws-s3'),
  ]);
  return { Uppy, AwsS3 };
}

export function useFileUpload(): UseFileUploadReturn {
  const apiClient = useApiClient();
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

    const { Uppy, AwsS3 } = await uppyPromiseRef.current;

    const uppy = new Uppy<UploadFileMeta, UploadFileBody>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: {
        allowedFileTypes: [...CHAT_UPLOAD_ALLOWED_MIME_TYPES],
        maxFileSize: CHAT_UPLOAD_MAX_FILE_SIZE_BYTES,
        maxNumberOfFiles: CHAT_UPLOAD_MAX_FILE_COUNT,
      },
    });

    uppy.use(AwsS3, {
      shouldUseMultipart: false,
      async getUploadParameters(file: UppyFile<Meta, Body>) {
        const preparedUpload = await apiClient.files.prepareUpload({
          originalName: file.name ?? 'file',
          mimetype: file.type || 'application/octet-stream',
          size: file.size ?? 0,
        });

        uppy.setFileMeta(file.id, {
          fileId: preparedUpload.fileId,
          key: preparedUpload.key,
          originalName: preparedUpload.originalName,
          mimetype: preparedUpload.mimetype,
          size: preparedUpload.size,
        });

        return {
          method: 'PUT',
          url: preparedUpload.uploadUrl,
          headers: preparedUpload.headers,
          fields: {},
        };
      },
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
  }, [apiClient]);

  const uploadFiles = useCallback(async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const fileArray = Array.from(files);

    // Transition: idle → preparing
    setUploadState((prev) => ({
      ...prev,
      state: 'preparing',
      isUploading: true,
      progress: 0,
      errors: [],
    }));

    try {
      const uppy = await getUppy();
      const completionPromises = new Map<string, Promise<UploadedFile>>();

      // Transition: preparing → uploading
      setUploadState((prev) => ({
        ...prev,
        state: 'uploading',
      }));

      for (const file of fileArray) {
        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });
      }

      const handleUploadSuccess = (file: UppyFile<UploadFileMeta, UploadFileBody> | undefined) => {
        // Transition: uploading → completing
        setUploadState((prev) => ({
          ...prev,
          state: 'completing',
        }));
        if (!file) {
          return;
        }

        const completionPromise = apiClient.files
          .completeUpload({
            fileId: file.meta.fileId || '',
            key: file.meta.key || '',
            originalName: file.meta.originalName ?? file.name ?? 'file',
            mimetype: file.meta.mimetype || file.type || 'application/octet-stream',
            size: file.meta.size || file.size || 0,
          })
          .then((result) => ({
            ...result.file,
            uploadedAt: new Date(result.file.uploadedAt),
          }));

        completionPromises.set(file.id, completionPromise);
      };

      uppy.on('upload-success', handleUploadSuccess);

      const result = await uppy.upload();
      uppy.off('upload-success', handleUploadSuccess);

      const completedFiles = await Promise.allSettled(completionPromises.values());

      const newFiles = completedFiles.flatMap((entry) =>
        entry.status === 'fulfilled' ? [entry.value] : [],
      );
      const uploadErrors = [
        ...(result?.failed ?? []).map((failedFile) => {
          const errorMessage =
            typeof failedFile.error === 'string'
              ? failedFile.error
              : String(failedFile.error ?? 'Upload failed');
          return `${failedFile.name}: ${errorMessage}`;
        }),
        ...completedFiles.flatMap((entry, index) =>
          entry.status === 'rejected'
            ? [
                `${fileArray[index]?.name || 'Unknown file'}: ${entry.reason instanceof Error ? entry.reason.message : 'Upload failed'}`,
              ]
            : [],
        ),
      ];

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
  }, []);

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
