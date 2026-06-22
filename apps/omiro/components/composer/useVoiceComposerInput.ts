import { logger } from '@hominem/telemetry';
import { useCallback, useState, useSyncExternalStore } from 'react';

import {
  getRecordingSnapshot,
  startRecording,
  stopRecording,
  subscribeRecording,
} from '~/components/media/audio.service';
import VoiceTranscriberModule from '~/modules/voice-transcriber';
import { useVoiceCleanup } from '~/services/ai';

import {
  createVoiceComposerError,
  deriveVoiceComposerState,
  isRecorderActive,
  maybeApplyCleanedTranscript,
  mergeTranscriptIntoDraft,
  type VoiceComposerError,
} from './voiceComposerInput.helpers';

interface UseVoiceComposerInputOptions {
  getMessage: () => string;
  setMessage: (message: string) => void;
  onError?: (error: VoiceComposerError) => void;
}

export function useVoiceComposerInput({
  getMessage,
  setMessage,
  onError,
}: UseVoiceComposerInputOptions) {
  const { cleanup, isCleaningVoice } = useVoiceCleanup();
  const recordingSnapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot,
    getRecordingSnapshot,
  );
  const [error, setError] = useState<VoiceComposerError | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const setVoiceError = useCallback(
    (nextError: VoiceComposerError) => {
      setError(nextError);
      onError?.(nextError);
    },
    [onError],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const processStoppedRecording = useCallback(
    async (fileUri: string) => {
      setIsTranscribing(true);
      setError(null);

      try {
        const result = await VoiceTranscriberModule.transcribeFile(fileUri);
        const rawText = result.rawText.trim();
        if (!rawText) return;

        const insertedDraft = mergeTranscriptIntoDraft(getMessage(), rawText);
        setMessage(insertedDraft);
        setIsTranscribing(false);
        void cleanup({
          rawText,
          locale: result.locale,
          source: 'apple-on-device',
        })
          .then((cleanupResult) => {
            setMessage(
              maybeApplyCleanedTranscript({
                currentDraft: getMessage(),
                insertedDraft,
                rawText,
                cleanedText: cleanupResult.cleanedText,
                changed: cleanupResult.changed,
              }),
            );
          })
          .catch((error: unknown) => {
            logger.warn('[voice-cleanup] background cleanup failed', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
      } catch (error) {
        logger.error('[voice-transcriber] transcription failed', error as Error);
        setVoiceError(createVoiceComposerError('transcription-failed'));
      } finally {
        setIsTranscribing(false);
      }
    },
    [cleanup, getMessage, setMessage, setVoiceError],
  );

  const stopAndTranscribeRecording = useCallback(async () => {
    const fileUri = await stopRecording();
    if (!fileUri) return;
    await processStoppedRecording(fileUri);
  }, [processStoppedRecording]);

  const ensureSpeechRecognitionPermission = useCallback(async () => {
    const currentStatus = await VoiceTranscriberModule.getPermissions();
    if (currentStatus === 'authorized') {
      return true;
    }

    const nextStatus = await VoiceTranscriberModule.requestPermissions();
    return nextStatus === 'authorized';
  }, []);

  const startVoiceRecording = useCallback(async () => {
    setError(null);
    try {
      const hasSpeechRecognitionPermission = await ensureSpeechRecognitionPermission();
      if (!hasSpeechRecognitionPermission) {
        setVoiceError(createVoiceComposerError('permission-denied'));
        return;
      }
    } catch {
      setVoiceError(createVoiceComposerError('permission-denied'));
      return;
    }

    const result = await startRecording();
    if (result.ok) return;

    setVoiceError(
      createVoiceComposerError(
        result.reason === 'permission-denied' ? 'permission-denied' : 'recording-failed',
      ),
    );
  }, [ensureSpeechRecognitionPermission, setVoiceError]);

  const handleVoicePress = useCallback(async () => {
    if (recordingSnapshot.state === 'RECORDING' || recordingSnapshot.state === 'PAUSED') {
      await stopAndTranscribeRecording();
      return;
    }

    if (recordingSnapshot.state !== 'IDLE') {
      return;
    }

    await startVoiceRecording();
  }, [recordingSnapshot.state, startVoiceRecording, stopAndTranscribeRecording]);

  const isRecording = isRecorderActive(recordingSnapshot.state);
  const voiceState = deriveVoiceComposerState({
    recorderState: recordingSnapshot.state,
    isTranscribing,
    isCleaningVoice,
    error,
  });

  const isBusy = voiceState !== 'idle' && voiceState !== 'failed';

  return {
    handleVoicePress,
    isBusy,
    isRecording,
    isCleaningVoice,
    voiceState,
    error,
    clearError,
  };
}
