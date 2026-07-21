import { describe, expect, it } from 'vitest';

import { getTaskVoiceCaptureErrorPresentation } from '~/services/tasks/taskVoiceCapture.helpers';

describe('task voice capture error presentation', () => {
  it('describes transcription cleanup accurately after a failure', () => {
    expect(getTaskVoiceCaptureErrorPresentation('transcription-failed').message).toContain(
      'temporary recording was cleaned up',
    );
  });

  it('keeps task extraction failure separate from transcription failure', () => {
    expect(getTaskVoiceCaptureErrorPresentation('creation-failed').message).toContain(
      'tasks could not be created',
    );
  });
});
