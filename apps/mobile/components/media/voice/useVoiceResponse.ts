import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useApiClient } from '@hominem/rpc/react';

import { playTTS } from '../audio.service';

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
      setIsLoading(true);
      setError(null);

      try {
        const info = await FileSystem.getInfoAsync(audioUri);
        if (!info.exists) {
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

        const formData = new FormData();
        formData.append('audio', {
          uri: audioUri,
          name: `recording-${Date.now()}.${ext}`,
          type: mimeType,
        } as unknown as Blob);

        const response = await client.voice.respondStream({ formData });
        const transcript = decodeURIComponent(response.headers.get('x-user-transcript') ?? '');

        if (!response.body) {
          throw new Error('No response body');
        }

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

        await playTTS(uri);
        return transcript;
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Voice response failed';
        setError(message);
        throw nextError;
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  return { respond, isLoading, error };
}
