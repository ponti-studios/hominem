import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  clearRecording,
  getRecordingSnapshot,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  subscribeRecording,
} from '../audio.service';

interface UseInputProps {
  onAudioReady?: (audioUri: string) => void;
  onError?: () => void;
}

export function useInput({ onAudioReady, onError }: UseInputProps = {}) {
  const [snapshot, setSnapshot] = useState(getRecordingSnapshot());

  useEffect(() => {
    return subscribeRecording(setSnapshot);
  }, []);

  const handleStartRecording = useCallback(async () => {
    const result = await startRecording();
    if (!result.ok) {
      onError?.();
    }
  }, [onError]);

  const handleStopRecording = useCallback(async () => {
    const fileUri = await stopRecording();
    if (fileUri) {
      onAudioReady?.(fileUri);
    }
  }, [onAudioReady]);

  const retryRecording = useCallback(async () => {
    if (!snapshot.lastRecordingUri) return;
    await handleStartRecording();
  }, [handleStartRecording, snapshot.lastRecordingUri]);

  const isRecording = snapshot.state === 'RECORDING';
  const isPaused = snapshot.state === 'PAUSED';

  return {
    isRecording,
    isPaused,
    meterings: snapshot.meterings,
    hasRetryRecording: !!snapshot.lastRecordingUri,
    recorderState: snapshot.state,
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
    pauseRecording,
    resumeRecording,
    retryRecording,
    clearRecording,
    buttonAction: useMemo(
      () => ({
        onPress: isRecording ? handleStopRecording : handleStartRecording,
      }),
      [handleStartRecording, handleStopRecording, isRecording],
    ),
  };
}
