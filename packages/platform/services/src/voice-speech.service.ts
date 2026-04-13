import { Buffer } from 'node:buffer';

import { logger } from '@hominem/utils/logger';

import { env } from './env';
import { VoiceError } from './voice-errors';
import { mapVoiceProviderError } from './voice-errors';

export { VoiceError } from './voice-errors';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface AudioChunk {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string;
      };
    };
    finish_reason?: string | null;
  }>;
}

async function collectAudioStream(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new VoiceError('No response body from audio stream', 'RESPONSE_FAILED', 500);
  }

  const decoder = new TextDecoder();
  const audioChunks: string[] = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice('data: '.length).trim();
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data) as AudioChunk;
          const audio = chunk.choices?.[0]?.delta?.audio;
          if (audio?.data) audioChunks.push(audio.data);
        } catch {
          // Malformed chunk — skip silently
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const audioB64 = audioChunks.join('');
  return Buffer.from(audioB64, 'base64');
}

export async function generateSpeechBuffer(input: {
  text: string;
  voice: string;
  speed: number;
}): Promise<{ audioBuffer: Buffer; mediaType: string }> {
  const requestId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (!env.OPENROUTER_API_KEY) {
    logger.error('[voice-speech] Missing OPENROUTER_API_KEY', { requestId });
    throw new VoiceError('Invalid API configuration.', 'AUTH', 401);
  }

  const model = 'openai/gpt-4o-audio-preview';

  logger.info('[voice-speech] Request started', {
    requestId,
    model,
    textLength: input.text.length,
    voice: input.voice,
    speed: input.speed,
  });

  let response: Response;

  try {
    response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hominem.app',
        'X-Title': 'Hominem',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: input.text }],
        modalities: ['audio'],
        audio: { voice: input.voice, format: 'mp3' },
        stream: true,
      }),
    });
  } catch (error) {
    logger.error('[voice-speech] Fetch failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new VoiceError('Speech generation request failed', 'RESPONSE_FAILED', 500);
  }

  logger.info('[voice-speech] HTTP response received', {
    requestId,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = (errorBody['error'] as Record<string, unknown>)?.['message'] as
      | string
      | undefined;

    logger.error('[voice-speech] API error response', {
      requestId,
      status: response.status,
      error: errorMessage ?? response.statusText,
    });

    const errorInfo = mapVoiceProviderError({
      kind: 'response',
      responseStatus: response.status,
      responseStatusText: response.statusText,
      ...(typeof errorMessage === 'string' ? { errorMessage } : {}),
    });
    throw new VoiceError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
  }

  try {
    const audioBuffer = await collectAudioStream(response);

    if (!audioBuffer.length) {
      throw new VoiceError('No audio data received from model', 'RESPONSE_FAILED', 500);
    }

    logger.info('[voice-speech] Request completed successfully', {
      requestId,
      audioSizeBytes: audioBuffer.length,
    });

    return {
      audioBuffer,
      mediaType: 'audio/mp3',
    };
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    if (error instanceof Error) {
      if (error.message.includes('quota')) {
        throw new VoiceError('API quota exceeded. Please try again later.', 'QUOTA', 429);
      }
      if (error.message.includes('API key')) {
        throw new VoiceError('Invalid API configuration.', 'AUTH', 401);
      }
      if (error.message.includes('content_policy')) {
        throw new VoiceError('Text content not allowed by content policy.', 'CONTENT_POLICY', 400);
      }
      throw new VoiceError(`Speech generation failed: ${error.message}`, 'SPEECH_FAILED', 500);
    }
    throw new VoiceError('Failed to generate speech', 'SPEECH_FAILED', 500);
  }
}