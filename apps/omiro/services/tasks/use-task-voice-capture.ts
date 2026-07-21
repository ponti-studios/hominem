import { logger } from '@hominem/telemetry';
import { File } from 'expo-file-system';
import { useCallback, useState } from 'react';

import { getNativeErrorCode, useVoiceRecorder } from '~/hooks/useVoiceRecorder';
import VoiceTranscriberModule, { VoiceTranscriberErrorCode } from '~/modules/voice-transcriber';

import { useVoiceTasks } from './use-voice-tasks';
export { getTaskVoiceCaptureErrorPresentation } from './taskVoiceCapture.helpers';

export type TaskVoiceCaptureState = 'idle' | 'recording' | 'transcribing' | 'creating' | 'failed';

export type TaskVoiceCaptureErrorCode =
  | 'permission-denied'
  | 'recording-failed'
  | 'transcription-failed'
  | 'creation-failed';

export interface TaskVoiceCaptureError {
  code: TaskVoiceCaptureErrorCode;
  transcript?: string;
}

export function useTaskVoiceCapture() {
  const { mutateAsync: createVoiceTasks } = useVoiceTasks();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  // Transcription/creation failures are a distinct concern from recording
  // lifecycle failures (permission/start), which useVoiceRecorder owns below —
  // keeping them in separate state avoids processStoppedRecording needing to
  // reference anything returned by that later hook call.
  const [taskError, setTaskError] = useState<TaskVoiceCaptureError | null>(null);

  const processStoppedRecording = useCallback(
    async (fileUri: string) => {
      setIsTranscribing(true);
      setCreatedCount(null);
      setTaskError(null);

      try {
        const result = await VoiceTranscriberModule.transcribeFile(fileUri);
        const rawText = result.rawText.trim();
        setIsTranscribing(false);
        if (!rawText) return;

        setIsCreating(true);
        try {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const output = await createVoiceTasks({
            transcript: rawText,
            referenceDate: new Date().toISOString(),
            timezone,
          });
          setCreatedCount(output.tasks.length);
        } catch (creationError) {
          logger.error('[task-voice-capture] task creation failed', creationError as Error);
          try {
            new File(fileUri).delete();
          } catch (deleteError) {
            logger.error('[task-voice-capture] orphaned file delete failed', deleteError as Error);
          }
          setTaskError({ code: 'creation-failed', transcript: rawText });
        } finally {
          setIsCreating(false);
        }
      } catch (transcriptionError) {
        logger.error('[task-voice-capture] transcription failed', transcriptionError as Error);
        try {
          new File(fileUri).delete();
        } catch (deleteError) {
          logger.error('[task-voice-capture] orphaned file delete failed', deleteError as Error);
        }
        const code = getNativeErrorCode(transcriptionError);
        setTaskError({
          code:
            code === VoiceTranscriberErrorCode.MISSING_PERMISSION
              ? 'permission-denied'
              : 'transcription-failed',
        });
      } finally {
        setIsTranscribing(false);
      }
    },
    [createVoiceTasks],
  );

  const {
    error: recorderError,
    clearError: clearRecorderError,
    handleMicPress,
    cancelVoiceRecording,
    isRecording,
    isRecordingElsewhere,
    recordingStartedAt,
  } = useVoiceRecorder<TaskVoiceCaptureError>({
    onRecordingStopped: processStoppedRecording,
    createPermissionDeniedError: () => ({ code: 'permission-denied' }),
    createRecordingFailedError: () => ({ code: 'recording-failed' }),
  });

  const error = recorderError ?? taskError;

  const clearError = useCallback(() => {
    clearRecorderError();
    setTaskError(null);
  }, [clearRecorderError]);

  const cancelVoiceCapture = useCallback(async () => {
    await cancelVoiceRecording('user-cancelled');
    setIsTranscribing(false);
    setIsCreating(false);
    setTaskError(null);
  }, [cancelVoiceRecording]);

  const state: TaskVoiceCaptureState = error
    ? 'failed'
    : isCreating
      ? 'creating'
      : isTranscribing
        ? 'transcribing'
        : isRecording
          ? 'recording'
          : 'idle';

  return {
    handleMicPress,
    cancelVoiceCapture,
    state,
    isBusy: state !== 'idle' && state !== 'failed',
    isRecording,
    isRecordingElsewhere,
    error,
    clearError,
    createdCount,
    recordingStartedAt,
  };
}
