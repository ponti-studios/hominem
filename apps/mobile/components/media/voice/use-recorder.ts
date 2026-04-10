import { emitVoiceEvent } from '@hominem/rpc/voice-events';
import { logger } from '@hominem/utils/logger';
import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type RecorderState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'PREPARING'
  | 'RECORDING'
  | 'PAUSED'
  | 'STOPPING';

interface UseRecorderProps {
  onAudioReady?: (audioUri: string) => void;
  onError?: () => void;
}

export function useRecorder({ onAudioReady, onError }: UseRecorderProps = {}) {
  const [meterings, setMeterings] = useState<number[]>([]);
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
  const [recorderState, setRecorderState] = useState<RecorderState>('IDLE');

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderStatus = useAudioRecorderState(recorder, 100);

  useEffect(() => {
    if (recorderStatus.metering != null) {
      setMeterings((prev) => {
        const next = [...prev, recorderStatus.metering as number];
        return next.length > 12 ? next.slice(-12) : next;
      });
    }
  }, [recorderStatus.metering]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
        deactivateKeepAwake().catch(() => {});
      }
      abortControllerRef.current?.abort();
    };
  }, [recorder]);

  const clearRecording = useCallback(() => {
    setLastRecordingUri(null);
    setMeterings([]);
    setRecorderState('IDLE');
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderState !== 'IDLE') return;

    try {
      setRecorderState('REQUESTING_PERMISSION');

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        if (isMountedRef.current) setRecorderState('IDLE');
        onError?.();
        return;
      }

      if (!isMountedRef.current) return;
      setRecorderState('PREPARING');

      activateKeepAwakeAsync().catch((error: Error) =>
        logger.error('[recorder] keep-awake activation failed', error),
      );

      await recorder.prepareToRecordAsync();

      if (!isMountedRef.current) {
        await recorder.stop().catch(() => {});
        return;
      }

      recorder.record();
      setMeterings([]);
      setRecorderState('RECORDING');
      emitVoiceEvent('voice_record_started', { platform: 'mobile-ios' });
    } catch (error) {
      logger.error('[recorder] start failed', error as Error);
      if (isMountedRef.current) setRecorderState('IDLE');
      onError?.();
    }
  }, [onError, recorderState, recorder]);

  const stopRecording = useCallback(async () => {
    if (!recorder.isRecording || recorderState === 'STOPPING') return;

    setRecorderState('STOPPING');

    await recorder.stop().catch((reason: Error) => {
      logger.error('[recorder] stop failed', reason);
    });

    deactivateKeepAwake().catch((error: Error) =>
      logger.error('[recorder] keep-awake deactivation failed', error),
    );

    if (!isMountedRef.current) return;

    const fileUri = recorder.uri;

    setMeterings([]);

    if (!fileUri) {
      setRecorderState('IDLE');
      return;
    }

    setLastRecordingUri(fileUri);
    emitVoiceEvent('voice_record_stopped', { platform: 'mobile-ios' });
    setRecorderState('IDLE');
    onAudioReady?.(fileUri);
  }, [onAudioReady, recorder, recorderState]);

  const retryRecording = useCallback(async () => {
    if (!lastRecordingUri) return;
    await startRecording();
  }, [lastRecordingUri, startRecording]);

  const pauseRecording = useCallback(async () => {
    if (recorderState !== 'RECORDING' || !recorder.isRecording) return;

    try {
      // expo-audio doesn't support pause, so we'll keep tracking with PAUSED state
      // but continue recording in the background for seamless resume
      setRecorderState('PAUSED');
    } catch (error) {
      logger.error('[recorder] pause failed', error as Error);
    }
  }, [recorder, recorderState]);

  const resumeRecording = useCallback(async () => {
    if (recorderState !== 'PAUSED') return;

    try {
      setRecorderState('RECORDING');
    } catch (error) {
      logger.error('[recorder] resume failed', error as Error);
    }
  }, [recorder, recorderState]);

  const isRecording = recorderState === 'RECORDING';
  const isPaused = recorderState === 'PAUSED';

  return {
    isRecording,
    isPaused,
    meterings,
    hasRetryRecording: !!lastRecordingUri,
    recorderState,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    retryRecording,
    clearRecording,
    buttonAction: useMemo(
      () => ({
        onPress: isRecording ? stopRecording : startRecording,
      }),
      [isRecording, startRecording, stopRecording],
    ),
  };
}
