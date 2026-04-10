import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileUpload } from './use-file-upload';

interface MockUploadFile {
  id: string;
  name?: string;
  type?: string;
  size?: number | null;
  data: File;
  meta: Record<string, string | number | boolean | null | undefined>;
  response?: {
    body: {
      success: true;
      file: {
        id: string;
        originalName: string;
        type: 'image' | 'document' | 'audio' | 'video' | 'unknown';
        mimetype: string;
        size: number;
        content?: string;
        url: string;
        uploadedAt: string;
        vectorIds: string[];
      };
      message: string;
    };
  };
  error?: string;
}

const mocks = vi.hoisted(() => {
  class MockUppy {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    private files: MockUploadFile[] = [];
    private xhrPluginOptions: {
      getResponseData?: (xhr: { responseText: string }) => unknown;
    } | null = null;

    constructor(_options: unknown) {}

    use(
      _plugin: unknown,
      options: { getResponseData?: (xhr: { responseText: string }) => unknown },
    ) {
      this.xhrPluginOptions = options;
      return this;
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      const handlers = this.listeners.get(event) ?? new Set();
      handlers.add(handler);
      this.listeners.set(event, handlers);
      return this;
    }

    off(event: string, handler: (...args: unknown[]) => void) {
      this.listeners.get(event)?.delete(handler);
      return this;
    }

    addFile(file: { name: string; type: string; data: File }) {
      const mockFile: MockUploadFile = {
        id: `file-${this.files.length + 1}`,
        name: file.name,
        type: file.type,
        size: file.data.size,
        data: file.data,
        meta: {},
      };
      this.files.push(mockFile);
      return mockFile.id;
    }

    setFileMeta(
      fileId: string,
      meta: Record<string, string | number | boolean | null | undefined>,
    ) {
      const file = this.files.find((entry) => entry.id === fileId);
      if (file) {
        file.meta = {
          ...file.meta,
          ...meta,
        };
      }
    }

    async upload() {
      this.emitProgress(100);

      for (const file of this.files) {
        const responseText = JSON.stringify({
          success: true,
          file: {
            id: '11111111-1111-4111-8111-111111111111',
            originalName: file.name ?? 'file',
            type: 'document',
            mimetype: file.type ?? 'application/octet-stream',
            size: file.size ?? 0,
            content: 'Summary',
            url: 'https://cdn.example/brief.pdf',
            uploadedAt: '2026-03-23T12:00:00.000Z',
            vectorIds: [],
          },
          message: 'File uploaded successfully',
        });
        const body = this.xhrPluginOptions?.getResponseData?.({ responseText });
        if (!body) {
          throw new Error('Expected upload response body');
        }
        file.response = { body: body as NonNullable<MockUploadFile['response']>['body'] };
      }

      return { successful: this.files, failed: [] as MockUploadFile[] };
    }

    cancelAll() {}

    clear() {
      this.files = [];
    }

    destroy() {
      this.clear();
      this.listeners.clear();
    }

    private emitProgress(progress: number) {
      const handlers = this.listeners.get('progress') ?? new Set();
      for (const handler of handlers) {
        if (typeof handler === 'function') {
          (handler as (progress: number) => void)(progress);
        }
      }
    }
  }

  return {
    MockUppy,
  };
});

vi.mock('@hominem/rpc/react', () => ({
  useApiClient: () => ({ files: {} }),
}));

vi.mock('@uppy/xhr-upload', () => ({
  default: class XHRUploadMock {},
}));

vi.mock('@uppy/core', () => ({
  default: mocks.MockUppy,
}));

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads files through one canonical request and stores returned files', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.uploadFiles([
        new File(['brief'], 'brief.pdf', { type: 'application/pdf' }),
      ]);
    });

    await waitFor(() => {
      expect(result.current.uploadState.uploadedFiles).toHaveLength(1);
      expect(result.current.uploadState.uploadedFiles[0]?.uploadedAt).toBeInstanceOf(Date);
      expect(result.current.uploadState.errors).toEqual([]);
      expect(result.current.uploadState.isUploading).toBe(false);
      expect(result.current.uploadState.progress).toBe(100);
      expect(result.current.uploadState.state).toBe('done');
    });
  });
});
