import { useApiClient } from '@hominem/rpc/react';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef, useState } from 'react';
import { playTTS, stopTTS } from './audio.service';

type TTSState = 'idle' | 'loading' | 'playing' | 'error';

interface UseTTSOptions {
  voice?: string;
  speed?: number;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < str.length; index++) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function useTTS(options: UseTTSOptions = {}) {
  const client = useApiClient();
  const [state, setState] = useState<TTSState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    stopTTS();
    setSpeakingId(null);
    setState('idle');
  }, []);

  const speak = useCallback(
    async (id: string, text: string) => {
      if (speakingId === id && state === 'playing') {
        stop();
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setSpeakingId(id);
      setState('loading');

      try {
        const cacheKey = hashString(`${text}:${options.voice ?? 'alloy'}:${options.speed ?? 1}`);
        const uri = `${FileSystem.cacheDirectory}tts-${cacheKey}.mp3`;
        const info = await FileSystem.getInfoAsync(uri);

        if (!info.exists) {
          const buffer = await client.voice.speech({
            text,
            voice: options.voice ?? 'alloy',
            speed: options.speed ?? 1,
          });

          if (controller.signal.aborted) {
            return;
          }

          await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(buffer), {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        if (controller.signal.aborted) {
          return;
        }

        await playTTS(uri);
        setState('playing');
      } catch (nextError) {
        if (controller.signal.aborted) {
          return;
        }

        setSpeakingId(null);
        setError(nextError instanceof Error ? nextError.message : 'Speech playback failed');
        setState('error');
      }
    },
    [client, options.speed, options.voice, speakingId, state, stop],
  );

  return { error, speak, speakingId, state, stop };
}
