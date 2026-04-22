import {
  VoiceTranscribeErrorSchema,
  VoiceTranscribeSuccessSchema,
} from '@hominem/rpc/schemas/voice.schema';
import { emitVoiceEvent, isVoiceErrorCode } from '@hominem/rpc/voice-events';
import { logger } from '@hominem/telemetry';
import { useMutation } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef } from 'react';

import { API_BASE_URL } from '~/constants';
import { useAuth } from '~/services/auth/auth-provider';

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

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
  const { getAuthHeaders } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const mutation = useMutation<string, Error, string>({
    mutationFn: async (audioUri: string) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const authHeaders = await getAuthHeaders();
      if (Object.keys(authHeaders).length === 0) {
        throw new Error('Missing auth session for voice transcription');
      }

      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > MAX_AUDIO_SIZE_BYTES) {
        const sizeMB = Math.round(fileInfo.size / (1024 * 1024));
        throw new Error(`Recording too large (${sizeMB}MB). Maximum is 25MB.`);
      }

      const formData = new FormData();
      const mimeType = getMimeTypeFromUri(audioUri);

      formData.append('audio', {
        uri: audioUri,
        name: `recording-${Date.now()}.${mimeType.split('/')[1] || 'webm'}`,
        type: mimeType,
      } as unknown as Blob);

      emitVoiceEvent('voice_transcribe_requested', {
        platform: 'mobile-ios',
        mimeType,
      });

      const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 60_000);

      const response = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const payload = VoiceTranscribeErrorSchema.parse(await response.json().catch(() => ({})));
        emitVoiceEvent('voice_transcribe_failed', {
          platform: 'mobile-ios',
          mimeType,
          ...(isVoiceErrorCode(payload.code) ? { errorCode: payload.code } : {}),
        });
        throw new Error(payload.error || `Voice transcription failed (${response.status})`);
      }

      const data = VoiceTranscribeSuccessSchema.parse(await response.json());
      emitVoiceEvent('voice_transcribe_succeeded', {
        platform: 'mobile-ios',
        mimeType,
      });
      return data.text;
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
