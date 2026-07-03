import { logger } from '@hominem/telemetry';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import { isRecorderActive } from '~/components/composer/voiceComposerInput.helpers';
import {
  discardRecording,
  getRecordingSnapshot,
  startRecording,
  stopRecording,
  subscribeRecording,
} from '~/components/media/audio.service';
import VoiceTranscriberModule from '~/modules/voice-transcriber';

import { useVoiceTasks } from './use-voice-tasks';

export type TaskVoiceCaptureState = 'idle' | 'recording' | 'transcribing' | 'creating' | 'failed';

export type TaskVoiceCaptureErrorCode =
  | 'permission-denied'
  | 'recording-failed'
  | 'transcription-failed'
  | 'creation-failed';

export interface TaskVoiceCaptureError {
  code: TaskVoiceCaptureErrorCode;
  title: string;
  message: string;
}

function createTaskVoiceCaptureError(code: TaskVoiceCaptureErrorCode): TaskVoiceCaptureError {
  switch (code) {
    case 'permission-denied':
      return {
        code,
        title: 'Microphone access required',
        message: 'Allow microphone and speech recognition access to add tasks by voice.',
      };
    case 'recording-failed':
      return {
        code,
        title: 'Voice recording failed',
        message: 'Omiro could not start recording right now.',
      };
    case 'transcription-failed':
      return {
        code,
        title: 'Voice transcription failed',
        message: 'Your recording was kept, but the transcript could not be generated.',
      };
    case 'creation-failed':
      return {
        code,
        title: "Couldn't create tasks",
        message: 'Your recording was transcribed, but the tasks could not be created.',
      };
  }
}

// Expo Modules attaches a stable `code` string to errors thrown from a
// native Exception (see VoiceTranscriberModule.swift's VoiceTranscriberException).
function getNativeErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function useTaskVoiceCapture() {
  const ownerId = useId();
  const { mutateAsync: createVoiceTasks } = useVoiceTasks();
  const recordingSnapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot,
    getRecordingSnapshot,
  );
  const [error, setError] = useState<TaskVoiceCaptureError | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const isStartingRef = useRef(false);

  const isOwnedByThisCapture = recordingSnapshot.ownerId === ownerId;
  const isRecordingElsewhere = isRecorderActive(recordingSnapshot.state) && !isOwnedByThisCapture;

  const ensureSpeechRecognitionPermission = useCallback(async () => {
    const currentStatus = await VoiceTranscriberModule.getPermissions();
    if (currentStatus === 'authorized') return true;

    const nextStatus = await VoiceTranscriberModule.requestPermissions();
    return nextStatus === 'authorized';
  }, []);

  const processStoppedRecording = useCallback(
    async (fileUri: string) => {
      setIsTranscribing(true);
      setError(null);
      setCreatedCount(null);

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
          setError(createTaskVoiceCaptureError('creation-failed'));
        } finally {
          setIsCreating(false);
        }
      } catch (transcriptionError) {
        logger.error(
          '[task-voice-capture] transcription failed',
          transcriptionError as Error,
        );
        const code = getNativeErrorCode(transcriptionError);
        setError(
          createTaskVoiceCaptureError(
            code === 'MISSING_PERMISSION' ? 'permission-denied' : 'transcription-failed',
          ),
        );
      } finally {
        setIsTranscribing(false);
      }
    },
    [createVoiceTasks],
  );

  const stopAndCreateTasks = useCallback(async () => {
    const result = await stopRecording(ownerId);
    if (!result.ok || !result.fileUri) return;
    await processStoppedRecording(result.fileUri);
  }, [ownerId, processStoppedRecording]);

  const cancelVoiceCapture = useCallback(async () => {
    await discardRecording(ownerId, 'user-cancelled');
    setError(null);
    setIsTranscribing(false);
    setIsCreating(false);
  }, [ownerId]);

  const startVoiceCapture = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setError(null);
    setCreatedCount(null);

    try {
      let hasSpeechRecognitionPermission: boolean;
      try {
        hasSpeechRecognitionPermission = await ensureSpeechRecognitionPermission();
      } catch {
        setError(createTaskVoiceCaptureError('permission-denied'));
        return;
      }

      if (!hasSpeechRecognitionPermission) {
        setError(createTaskVoiceCaptureError('permission-denied'));
        return;
      }

      const result = await startRecording(ownerId);
      // A concurrent duplicate tap racing this async permission check is not a
      // real failure — the recorder singleton correctly rejected the second
      // caller, so there's nothing to surface to the user.
      if (result.ok || result.reason === 'busy') return;

      setError(
        createTaskVoiceCaptureError(
          result.reason === 'permission-denied' ? 'permission-denied' : 'recording-failed',
        ),
      );
    } finally {
      isStartingRef.current = false;
    }
  }, [ensureSpeechRecognitionPermission, ownerId]);

  const handleMicPress = useCallback(async () => {
    if (isRecordingElsewhere) return;

    if (
      isOwnedByThisCapture &&
      (recordingSnapshot.state === 'RECORDING' || recordingSnapshot.state === 'PAUSED')
    ) {
      await stopAndCreateTasks();
      return;
    }

    if (recordingSnapshot.state !== 'IDLE') return;

    await startVoiceCapture();
  }, [
    isOwnedByThisCapture,
    isRecordingElsewhere,
    recordingSnapshot.state,
    startVoiceCapture,
    stopAndCreateTasks,
  ]);

  // Discard (never transcribe) an owned recording left behind when this
  // hook disappears — an unmount or navigation-away is abandonment, not
  // user intent to submit.
  useEffect(() => {
    return () => {
      const snapshot = getRecordingSnapshot();
      if (snapshot.ownerId === ownerId && isRecorderActive(snapshot.state)) {
        void discardRecording(ownerId, 'unmounted');
      }
    };
  }, [ownerId]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const snapshot = getRecordingSnapshot();
        if (snapshot.ownerId === ownerId && isRecorderActive(snapshot.state)) {
          void discardRecording(ownerId, 'navigated-away');
        }
      };
    }, [ownerId]),
  );

  const isRecording = isOwnedByThisCapture && isRecorderActive(recordingSnapshot.state);
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
    clearError: () => setError(null),
    createdCount,
    recordingStartedAt: isRecording ? recordingSnapshot.startedAt : null,
    recordingMeterings: isRecording ? recordingSnapshot.meterings : [],
  };
}
