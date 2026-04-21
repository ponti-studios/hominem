import {
  VoiceTranscribeErrorSchema,
  VoiceTranscribeSuccessSchema,
} from '@hakumi/rpc/schemas/voice.schema';
import type { VoiceErrorCode } from '@hakumi/rpc/voice-events';
import { useMutation } from '@tanstack/react-query';

interface TranscribeVariables {
  audioBlob: Blob;
  language?: string;
}

interface TranscribeResult {
  text: string;
}

/** Must match VOICE_TRANSCRIPTION_MAX_SIZE_BYTES on the server. */
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

export function useTranscribe() {
  return useMutation<TranscribeResult, Error, TranscribeVariables>({
    mutationFn: async ({ audioBlob, language }) => {
      if (audioBlob.size > MAX_AUDIO_SIZE_BYTES) {
        const sizeMB = Math.round(audioBlob.size / (1024 * 1024));
        throw new Error(`Recording too large (${sizeMB}MB). Maximum is 25MB.`);
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      if (language) {
        formData.append('language', language);
      }

      const apiBase = import.meta.env.VITE_PUBLIC_API_URL as string;
      const response = await fetch(`${apiBase}/api/voice/transcribe`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const err = VoiceTranscribeErrorSchema.parse(await response.json().catch(() => ({})));
        const error = new Error(err.error ?? 'Transcription failed');
        if (err.code) {
          (error as Error & { code?: VoiceErrorCode | string }).code = err.code;
        }
        throw error;
      }

      const payload = VoiceTranscribeSuccessSchema.parse(await response.json());
      return { text: payload.text };
    },
  });
}
