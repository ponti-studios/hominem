import { useApiClient } from '@hominem/rpc/react';
import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useRef, useState } from 'react';

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

/** Simple string hash for cache-key generation (FNV-1a 32-bit). */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function useTTS(options: UseTTSOptions = {}) {
  const client = useApiClient();
  const [state, setState] = useState<TTSState>('idle');
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const abortRef = useRef<AbortController | null>(null);

  const speak = useCallback(
    async (text: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setState('loading');

      try {
        // Cache key based on content so identical text reuses the cached file
        const cacheKey = hashString(`${text}:${options.voice ?? 'alloy'}:${options.speed ?? 1}`);
        const uri = `${FileSystem.cacheDirectory}tts-${cacheKey}.mp3`;

        // Check cache first — skip the network call entirely on cache hit
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          const buffer = await client.voice.speech({
            text,
            voice: options.voice ?? 'alloy',
            speed: options.speed ?? 1,
          });

          if (controller.signal.aborted) return;

          await FileSystem.writeAsStringAsync(uri, arrayBufferToBase64(buffer), {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        if (controller.signal.aborted) return;

        setState('playing');
        player.replace({ uri });
        player.play();
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Speech playback failed');
        setState('error');
      }
    },
    [client, options.voice, options.speed, player],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    player.pause();
    setState('idle');
  }, [player]);

  return { speak, stop, state, error };
}
