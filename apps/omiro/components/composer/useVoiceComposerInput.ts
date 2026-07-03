import type { VoiceDiscardReason } from '@hominem/rpc/voice-events';
import { logger } from '@hominem/telemetry';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import {
  discardRecording,
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

// Expo Modules attaches a stable `code` string to errors thrown from a
// native Exception (see VoiceTranscriberModule.swift's VoiceTranscriberException).
function getNativeErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

export function useVoiceComposerInput({
  getMessage,
  setMessage,
  onError,
}: UseVoiceComposerInputOptions) {
  const ownerId = useId();
  const { cleanup, isCleaningVoice } = useVoiceCleanup();
  const recordingSnapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot,
    getRecordingSnapshot,
  );
  const [error, setError] = useState<VoiceComposerError | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isStartingRef = useRef(false);

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

  const isOwnedByThisComposer = recordingSnapshot.ownerId === ownerId;
  const isRecordingElsewhere = isRecorderActive(recordingSnapshot.state) && !isOwnedByThisComposer;

  const processStoppedRecording = useCallback(
    async (fileUri: string) => {
      logger.info('[voice-transcriber] processStoppedRecording: start', { fileUri });
      setIsTranscribing(true);
      setError(null);

      try {
        logger.info('[voice-transcriber] processStoppedRecording: calling transcribeFile');
        const result = await VoiceTranscriberModule.transcribeFile(fileUri);
        logger.info('[voice-transcriber] processStoppedRecording: transcribeFile resolved', {
          rawTextLength: result.rawText.length,
          locale: result.locale,
          isOnDevice: result.isOnDevice,
        });
        const rawText = result.rawText.trim();
        if (!rawText) {
          logger.warn('[voice-transcriber] processStoppedRecording: empty rawText, aborting');
          return;
        }

        const insertedDraft = mergeTranscriptIntoDraft(getMessage(), rawText);
        setMessage(insertedDraft);
        setIsTranscribing(false);
        logger.info('[voice-transcriber] processStoppedRecording: draft updated, starting cleanup');
        void cleanup({
          rawText,
          locale: result.locale,
          source: 'apple-on-device',
        })
          .then((cleanupResult) => {
            logger.info('[voice-cleanup] cleanup resolved', {
              changed: cleanupResult.changed,
            });
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
        logger.error(
          '[voice-transcriber] processStoppedRecording: transcription failed',
          error as Error,
        );
        // Permission can be revoked mid-session (e.g. the user backgrounds
        // the app, revokes Speech Recognition in Settings, then returns and
        // stops a long recording) — route that case to the same actionable
        // permission-denied UX instead of a generic transcription failure.
        const code = getNativeErrorCode(error);
        logger.info('[voice-transcriber] processStoppedRecording: native error code', { code });
        setVoiceError(
          createVoiceComposerError(
            code === 'MISSING_PERMISSION' ? 'permission-denied' : 'transcription-failed',
          ),
        );
      } finally {
        setIsTranscribing(false);
        logger.info('[voice-transcriber] processStoppedRecording: finished');
      }
    },
    [cleanup, getMessage, setMessage, setVoiceError],
  );

  const stopAndTranscribeRecording = useCallback(async () => {
    logger.info('[voice-transcriber] stopAndTranscribeRecording: calling stopRecording', {
      ownerId,
    });
    const result = await stopRecording(ownerId);
    logger.info('[voice-transcriber] stopAndTranscribeRecording: stopRecording resolved', {
      ok: result.ok,
      fileUri: result.ok ? result.fileUri : undefined,
      reason: result.ok ? undefined : result.reason,
    });
    if (!result.ok || !result.fileUri) {
      logger.warn(
        '[voice-transcriber] stopAndTranscribeRecording: no fileUri, aborting transcription',
      );
      return;
    }
    await processStoppedRecording(result.fileUri);
  }, [ownerId, processStoppedRecording]);

  const cancelVoiceRecording = useCallback(
    async (reason: VoiceDiscardReason = 'user-cancelled') => {
      await discardRecording(ownerId, reason);
      setError(null);
      setIsTranscribing(false);
    },
    [ownerId],
  );

  const ensureSpeechRecognitionPermission = useCallback(async () => {
    const currentStatus = await VoiceTranscriberModule.getPermissions();
    if (currentStatus === 'authorized') {
      return true;
    }

    const nextStatus = await VoiceTranscriberModule.requestPermissions();
    return nextStatus === 'authorized';
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setError(null);

    try {
      let hasSpeechRecognitionPermission: boolean;
      try {
        hasSpeechRecognitionPermission = await ensureSpeechRecognitionPermission();
      } catch {
        setVoiceError(createVoiceComposerError('permission-denied'));
        return;
      }

      if (!hasSpeechRecognitionPermission) {
        setVoiceError(createVoiceComposerError('permission-denied'));
        return;
      }

      const result = await startRecording(ownerId);
      // A concurrent duplicate tap racing this async permission check is not a
      // real failure — the recorder singleton correctly rejected the second
      // caller, so there's nothing to surface to the user.
      if (result.ok || result.reason === 'busy') return;

      setVoiceError(
        createVoiceComposerError(
          result.reason === 'permission-denied' ? 'permission-denied' : 'recording-failed',
        ),
      );
    } finally {
      isStartingRef.current = false;
    }
  }, [ensureSpeechRecognitionPermission, ownerId, setVoiceError]);

  const handleVoicePress = useCallback(async () => {
    logger.info('[voice-transcriber] handleVoicePress', {
      isRecordingElsewhere,
      isOwnedByThisComposer,
      state: recordingSnapshot.state,
    });

    if (isRecordingElsewhere) return;

    if (
      isOwnedByThisComposer &&
      (recordingSnapshot.state === 'RECORDING' || recordingSnapshot.state === 'PAUSED')
    ) {
      logger.info('[voice-transcriber] handleVoicePress: stopping+transcribing');
      await stopAndTranscribeRecording();
      return;
    }

    if (recordingSnapshot.state !== 'IDLE') {
      logger.info('[voice-transcriber] handleVoicePress: ignored, not IDLE and not owned-active');
      return;
    }

    logger.info('[voice-transcriber] handleVoicePress: starting recording');
    await startVoiceRecording();
  }, [
    isOwnedByThisComposer,
    isRecordingElsewhere,
    recordingSnapshot.state,
    startVoiceRecording,
    stopAndTranscribeRecording,
  ]);

  // Discard (never transcribe) an owned recording left behind when this
  // composer disappears — an unmount or navigation-away is abandonment, not
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

  const isRecording = isOwnedByThisComposer && isRecorderActive(recordingSnapshot.state);
  const voiceState = deriveVoiceComposerState({
    recorderState: isOwnedByThisComposer ? recordingSnapshot.state : 'IDLE',
    isTranscribing,
    isCleaningVoice,
    error,
  });

  const isBusy = voiceState !== 'idle' && voiceState !== 'failed';

  return {
    handleVoicePress,
    cancelVoiceRecording,
    isBusy,
    isRecording,
    isRecordingElsewhere,
    isCleaningVoice,
    voiceState,
    error,
    clearError,
    recordingStartedAt: isRecording ? recordingSnapshot.startedAt : null,
    recordingMeterings: isRecording ? recordingSnapshot.meterings : [],
  };
}
