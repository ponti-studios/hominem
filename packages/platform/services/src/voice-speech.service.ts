import { Buffer } from 'node:buffer';

import { experimental_generateSpeech } from 'ai';

import { getOpenAIAudioProvider } from './ai-model';
import { VoiceSpeechError } from './voice-errors';

export { VoiceSpeechError } from './voice-errors';

export async function generateSpeechBuffer(input: { text: string; voice: string; speed: number }) {
  let audioProvider: ReturnType<typeof getOpenAIAudioProvider>;
  try {
    audioProvider = getOpenAIAudioProvider();
  } catch {
    throw new VoiceSpeechError('Invalid API configuration.', 'AUTH', 401);
  }

  try {
    const speech = await experimental_generateSpeech({
      model: audioProvider.speech('tts-1'),
      text: input.text,
      voice: input.voice,
      outputFormat: 'mp3',
      speed: input.speed,
    });

    return {
      audioBuffer: Buffer.from(speech.audio.base64, 'base64'),
      mediaType: speech.audio.mimeType,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        throw new VoiceSpeechError('API quota exceeded. Please try again later.', 'QUOTA', 429);
      }
      if (error.message.includes('API key')) {
        throw new VoiceSpeechError('Invalid API configuration.', 'AUTH', 401);
      }
      if (error.message.includes('content_policy')) {
        throw new VoiceSpeechError(
          'Text content not allowed by content policy.',
          'CONTENT_POLICY',
          400,
        );
      }
      throw new VoiceSpeechError(
        `Speech generation failed: ${error.message}`,
        'SPEECH_FAILED',
        500,
      );
    }

    throw new VoiceSpeechError('Failed to generate speech', 'SPEECH_FAILED', 500);
  }
}
