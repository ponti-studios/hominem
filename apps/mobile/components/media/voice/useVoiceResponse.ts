import { useApiClient } from '@hominem/rpc/react';
import { logger } from '@hominem/telemetry';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useState } from 'react';

import { playTTS } from '../audio.service';

function createVoiceRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error
    ? ((error as { status?: number }).status ?? undefined)
    : undefined;
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function useVoiceResponse() {
  const client = useApiClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(
    async (audioUri: string) => {
      const requestId = createVoiceRequestId('mobile-vr');
      setIsLoading(true);
      setError(null);

      logger.info('[voice-response] request started', {
        requestId,
        audioUri,
      });

      try {
        const info = await FileSystem.getInfoAsync(audioUri);
        if (!info.exists) {
          logger.warn('[voice-response] recording file missing', {
            requestId,
            audioUri,
          });
          throw new Error('Recording file no longer exists');
        }

        const ext = audioUri.split('.').pop() ?? 'webm';
        const mimeType =
          ext === 'mp3'
            ? 'audio/mpeg'
            : ext === 'mp4' || ext === 'm4a'
              ? 'audio/mp4'
              : ext === 'wav'
                ? 'audio/wav'
                : ext === 'ogg'
                  ? 'audio/ogg'
                  : 'audio/webm';

        const audioFile = {
          uri: audioUri,
          name: `recording-${Date.now()}.${ext}`,
          type: mimeType,
        } as unknown as Blob;

        logger.info('[voice-response] sending multipart request', {
          requestId,
          audioUri,
          mimeType,
          fileName: audioFile.name,
          sizeBytes: info.size,
        });

        const response = await client.api.voice.respond.stream.$post(
          {
            form: { audio: audioFile },
          } as never,
          {
            headers: {
              'X-Voice-Request-Id': requestId,
            },
          },
        );

        logger.info('[voice-response] response received', {
          requestId,
          status: response.status,
          contentType: response.headers.get('content-type'),
          transcriptHeaderPresent: response.headers.has('x-user-transcript'),
        });

        const transcript = decodeURIComponent(response.headers.get('x-user-transcript') ?? '');

        if (!response.body) {
          logger.error('[voice-response] missing response body', {
            requestId,
            status: response.status,
          });
          throw new Error('No response body');
        }

        logger.info('[voice-response] streaming audio response', {
          requestId,
        });

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const buffer = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.byteLength;
        }

        const uri = `${FileSystem.cacheDirectory}voice-response-${Date.now()}.pcm`;
        await FileSystem.writeAsStringAsync(uri, bufferToBase64(buffer), {
          encoding: FileSystem.EncodingType.Base64,
        });

        logger.info('[voice-response] response audio cached', {
          requestId,
          cacheUri: uri,
          byteLength: buffer.byteLength,
          transcriptLength: transcript.length,
        });

        logger.info('[voice-response] playback starting', {
          requestId,
          cacheUri: uri,
        });
        await playTTS(uri);

        logger.info('[voice-response] playback started', {
          requestId,
          cacheUri: uri,
        });
        return transcript;
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Voice response failed';
        logger.error('[voice-response] request failed', {
          requestId,
          error: getErrorMessage(nextError),
          status: getErrorStatus(nextError),
          message,
        });
        setError(message);
        throw nextError;
      } finally {
        logger.info('[voice-response] request finished', {
          requestId,
        });
        setIsLoading(false);
      }
    },
    [client],
  );

  return { respond, isLoading, error };
}
