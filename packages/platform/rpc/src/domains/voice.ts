import type { RawHonoClient } from '../core/raw-client';

interface VoiceSpeechInput {
  text: string;
  voice?: string;
  speed?: number;
}

interface VoiceRespondInput {
  formData: FormData;
}

export interface VoiceClient {
  speech(input: VoiceSpeechInput): Promise<ArrayBuffer>;
  respondStream(input: VoiceRespondInput): Promise<Response>;
}

export function createVoiceClient(rawClient: RawHonoClient): VoiceClient {
  return {
    async speech(input: VoiceSpeechInput) {
      const res = await rawClient.post('/api/voice/speech', {
        json: {
          text: input.text,
          voice: input.voice ?? 'alloy',
          speed: input.speed ?? 1,
        },
      });

      return res.arrayBuffer();
    },
    async respondStream(input: VoiceRespondInput) {
      return rawClient.post('/api/voice/respond/stream', {
        body: input.formData,
      });
    },
  };
}
