import { emitVoiceEvent } from '@hominem/rpc/voice-events';
import { logger } from '@hominem/telemetry';
import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef } from 'react';

type SpeechRecognitionPermissionStatus = 'authorized' | 'denied' | 'notDetermined' | 'restricted';

type VoiceTranscriberModule = {
  requestPermissions(): Promise<SpeechRecognitionPermissionStatus>;
  transcribeFile(audioUri: string): Promise<string>;
};

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

function createVoiceRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getMimeTypeFromUri(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.mp3')) return 'audio/mpeg';
  if (normalized.endsWith('.mp4') || normalized.endsWith('.m4a')) return 'audio/mp4';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/webm';
}

export function useTranscriber({
  onSuccess,
  onError,
}: {
  onSuccess?: (data: string) => void;
  onError?: () => void;
} = {}) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const getVoiceTranscriberModule = useCallback(() => {
    try {
      return require('~/modules/voice-transcriber').default as VoiceTranscriberModule;
    } catch (error) {
      logger.error('[transcriber] native module unavailable', { error });
      throw new Error('On-device speech recognition is unavailable.');
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const mutation = useMutation<string, Error, string>({
    mutationFn: async (audioUri: string) => {
      const requestId = createVoiceRequestId('mobile-vt');
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const voiceTranscriber = getVoiceTranscriberModule();

      logger.info('[transcriber] request started', {
        requestId,
        audioUri,
      });

      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > MAX_AUDIO_SIZE_BYTES) {
        const sizeMB = Math.round(fileInfo.size / (1024 * 1024));
        throw new Error(`Recording too large (${sizeMB}MB). Maximum is 25MB.`);
      }

      const mimeType = getMimeTypeFromUri(audioUri);

      emitVoiceEvent('voice_transcribe_requested', {
        platform: 'mobile-ios',
        mimeType,
        sizeBytes: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
      });

      logger.info('[transcriber] starting on-device transcription', {
        requestId,
        mimeType,
        sizeBytes: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
      });

      const permissionStatus = await voiceTranscriber.requestPermissions();
      if (permissionStatus !== 'authorized') {
        throw new Error('Speech recognition permission is required to transcribe on device.');
      }

      const data = await voiceTranscriber.transcribeFile(audioUri);
      emitVoiceEvent('voice_transcribe_succeeded', {
        platform: 'mobile-ios',
        mimeType,
      });
      logger.info('[transcriber] request completed successfully', {
        requestId,
        transcriptLength: data.length,
        transcriptPreview: data.slice(0, 120),
      });
      return data;
    },
    onSuccess,
    onError: (error) => {
      if (error.name === 'AbortError') return;
      logger.error('[transcriber] mutation failed', error);
      onError?.();
    },
  });

  return { ...mutation, cancel };
}
