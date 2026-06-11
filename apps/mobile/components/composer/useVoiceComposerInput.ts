import { logger } from '@hominem/telemetry';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { Alert } from 'react-native';

import {
  getRecordingSnapshot,
  startRecording,
  stopRecording,
  subscribeRecording,
} from '~/components/media/audio.service';
import VoiceTranscriberModule from '~/modules/voice-transcriber/src/VoiceTranscriberModule';
import { useVoiceCleanup } from '~/services/ai';

import { mergeTranscriptIntoDraft, replaceTranscriptInDraft } from './voiceComposerInput.helpers';

interface UseVoiceComposerInputOptions {
  message: string;
  setMessage: (message: string) => void;
}

export function useVoiceComposerInput({ message, setMessage }: UseVoiceComposerInputOptions) {
  const { cleanup, isCleaningVoice } = useVoiceCleanup();
  const recordingSnapshot = useSyncExternalStore(
    subscribeRecording,
    getRecordingSnapshot,
    getRecordingSnapshot,
  );
  const draftRef = useRef(message);
  draftRef.current = message;

  const handleVoicePress = useCallback(async () => {
    if (recordingSnapshot.state === 'RECORDING' || recordingSnapshot.state === 'PAUSED') {
      const fileUri = await stopRecording();
      if (!fileUri) return;

      try {
        const result = await VoiceTranscriberModule.transcribeFile(fileUri);
        const rawText = result.rawText.trim();
        if (!rawText) return;

        const nextDraft = mergeTranscriptIntoDraft(draftRef.current, rawText);
        setMessage(nextDraft);

        void cleanup({
          rawText,
          locale: result.locale,
          source: 'apple-on-device',
        })
          .then((cleanupResult) => {
            if (!cleanupResult.changed) return;
            if (draftRef.current !== nextDraft) return;
            setMessage(replaceTranscriptInDraft(nextDraft, rawText, cleanupResult.cleanedText));
          })
          .catch((error: unknown) => {
            logger.warn('[voice-cleanup] background cleanup failed', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
      } catch (error) {
        logger.error('[voice-transcriber] transcription failed', error as Error);
        Alert.alert(
          'Voice transcription failed',
          'Your recording was kept, but the transcript could not be generated.',
        );
      }
      return;
    }

    if (recordingSnapshot.state !== 'IDLE') {
      return;
    }

    const result = await startRecording();
    if (result.ok) return;

    if (result.reason === 'permission-denied') {
      Alert.alert(
        'Microphone access required',
        'Allow microphone and speech recognition access to record a voice note.',
      );
      return;
    }

    Alert.alert('Voice recording failed', 'Hakumi could not start recording right now.');
  }, [cleanup, recordingSnapshot.state, setMessage]);

  const isRecording =
    recordingSnapshot.state === 'REQUESTING_PERMISSION' ||
    recordingSnapshot.state === 'PREPARING' ||
    recordingSnapshot.state === 'RECORDING' ||
    recordingSnapshot.state === 'PAUSED' ||
    recordingSnapshot.state === 'STOPPING';

  const isBusy = isRecording || isCleaningVoice;

  return {
    handleVoicePress,
    isBusy,
    isRecording,
    isCleaningVoice,
  };
}
