import { useEffect } from 'react';
import type { FetcherWithComponents } from 'react-router';

interface EditorSubmissionResult<TRecord> {
  success: boolean;
  error?: string;
  message?: string;
  data?: TRecord;
}

interface UseCareerEditorSubmissionOptions<TRecord> {
  fetcher: FetcherWithComponents<unknown>;
  addToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void;
  successMessage: string;
  errorMessage: string;
  isNew: boolean;
  onCreateSuccess?: (record: TRecord) => void;
}

export function useCareerEditorSubmission<TRecord>({
  fetcher,
  addToast,
  successMessage,
  errorMessage,
  isNew,
  onCreateSuccess,
}: UseCareerEditorSubmissionOptions<TRecord>) {
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) {
      return;
    }

    const result = fetcher.data as EditorSubmissionResult<TRecord>;

    if (result.success) {
      addToast(result.message || successMessage, 'success');

      if (isNew && result.data && onCreateSuccess) {
        onCreateSuccess(result.data);
      }

      return;
    }

    addToast(result.error ? `${errorMessage}: ${result.error}` : errorMessage, 'error');
  }, [addToast, errorMessage, fetcher.data, fetcher.state, isNew, onCreateSuccess, successMessage]);
}
