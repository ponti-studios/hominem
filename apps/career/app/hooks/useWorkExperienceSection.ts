import type { UpdateWorkExperienceInput, WorkExperienceRecord } from '@hominem/db';
import { useFetcher } from 'react-router';

import { useCareerEditorSubmission } from './useCareerEditorSubmission';

export function useWorkExperienceSection({
  errorMessage,
  onSuccess,
}: {
  errorMessage: string;
  onSuccess?: () => void;
}) {
  const fetcher = useFetcher();
  const { submissionError, clearSubmissionError } = useCareerEditorSubmission({
    fetcher,
    errorMessage,
    onSuccess: (result) => {
      if (result.operation === 'update') {
        onSuccess?.();
      }
    },
  });

  return {
    fetcher,
    isSubmitting: fetcher.state !== 'idle',
    submissionError,
    clearSubmissionError,
    submitUpdates: (updates: UpdateWorkExperienceInput) =>
      submitWorkExperienceUpdates(fetcher, clearSubmissionError, updates),
  };
}

export function submitDelete(
  fetcher: ReturnType<typeof useFetcher>,
  clearSubmissionError: () => void,
  workExperience: WorkExperienceRecord,
) {
  const formData = new FormData();
  formData.append('operation', 'delete');
  formData.append('portfolioId', workExperience.portfolioId);
  clearSubmissionError();
  fetcher.submit(formData, { method: 'POST' });
}

function submitWorkExperienceUpdates(
  fetcher: ReturnType<typeof useFetcher>,
  clearSubmissionError: () => void,
  updates: UpdateWorkExperienceInput,
) {
  const formData = new FormData();
  formData.append('operation', 'update');
  formData.append('updates', JSON.stringify(updates));
  clearSubmissionError();
  fetcher.submit(formData, { method: 'POST' });
}
