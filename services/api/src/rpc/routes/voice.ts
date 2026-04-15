import type {
  MobileVoiceResponseErrorOutput,
  MobileVoiceTranscriptionErrorOutput,
  MobileVoiceTranscriptionOutput,
} from '@hominem/rpc/types/mobile.types';
import {
  generateVoiceResponse,
  generateVoiceResponseStream,
  VoiceError,
} from '@hominem/services/voice-response';
import { generateSpeechBuffer } from '@hominem/services/voice-speech';
import { transcribeVoiceBuffer } from '@hominem/services/voice-transcription';
import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import * as z from 'zod';

import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';

type VoiceErrorOutput = MobileVoiceResponseErrorOutput | MobileVoiceTranscriptionErrorOutput;

type VoiceErrorStatusCode = 400 | 401 | 429 | 500;

function getVoiceErrorStatusCode(statusCode: number): VoiceErrorStatusCode {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

function respondWithJsonError(
  c: Context<AppContext>,
  body: VoiceErrorOutput,
  statusCode: VoiceErrorStatusCode,
): Response {
  return c.newResponse(JSON.stringify(body), statusCode, {
    'Content-Type': 'application/json',
  });
}

function parseVoiceRequestBody(body: Record<string, unknown>) {
  const input = body.audio;
  const audioFile = Array.isArray(input) ? input[0] : input;
  const languageInput = body.language;
  const language =
    typeof languageInput === 'string' && languageInput.trim().length > 0
      ? languageInput.trim()
      : undefined;

  return { audioFile, language };
}

const voiceRoutes = new Hono<AppContext>().post('/transcribe', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { audioFile, language } = parseVoiceRequestBody(body);

    if (!(audioFile instanceof File)) {
      return respondWithJsonError(
        c,
        { error: 'No audio file provided', code: 'INVALID_FORMAT' },
        400,
      );
    }

    const output = await transcribeVoiceBuffer({
      buffer: await audioFile.arrayBuffer(),
      mimeType: audioFile.type,
      ...(audioFile.name ? { fileName: audioFile.name } : {}),
      ...(language ? { language } : {}),
    });

    const response: MobileVoiceTranscriptionOutput = {
      text: output.text,
      ...(output.language ? { language: output.language } : {}),
      ...(typeof output.duration === 'number' ? { duration: output.duration } : {}),
      ...(output.words ? { words: output.words } : {}),
      ...(output.segments ? { segments: output.segments } : {}),
    };

    return c.json(response);
  } catch (error) {
    if (error instanceof VoiceError) {
      return respondWithJsonError(
        c,
        { error: error.message, code: error.code },
        getVoiceErrorStatusCode(error.statusCode),
      );
    }
    return respondWithJsonError(
      c,
      { error: 'Failed to transcribe audio', code: 'TRANSCRIBE_FAILED' },
      500,
    );
  }
});

export const authenticatedVoiceRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .use(
    '/speech',
    rateLimitMiddleware({ bucket: 'voice-speech', identifier: 'speech', windowSec: 60, max: 30 }),
  )
  .use(
    '/respond',
    rateLimitMiddleware({ bucket: 'voice-respond', identifier: 'respond', windowSec: 60, max: 20 }),
  )
  .use(
    '/respond/stream',
    rateLimitMiddleware({ bucket: 'voice-respond-stream', identifier: 'respond-stream', windowSec: 60, max: 20 }),
  )
  .route('', voiceRoutes)
  .post(
    '/speech',
    zValidator(
      'json',
      z.object({
        text: z.string().min(1).max(4096),
        voice: z.string().default('alloy'),
        speed: z.number().min(0.25).max(4).default(1),
      }),
    ),
    async (c) => {
      const { text, voice, speed } = c.req.valid('json');
      try {
        const { audioBuffer, mediaType } = await generateSpeechBuffer({ text, voice, speed });
        c.header('Content-Type', mediaType);
        c.header('Content-Length', String(audioBuffer.byteLength));
        return c.body(new Uint8Array(audioBuffer));
      } catch (error) {
        if (error instanceof VoiceError) {
          return c.json({ error: error.message }, getVoiceErrorStatusCode(error.statusCode));
        }
        return c.json({ error: 'Failed to generate speech' }, 500);
      }
    },
  )
  .post('/respond', async (c) => {
    try {
      const body = await c.req.parseBody();
      const { audioFile, language } = parseVoiceRequestBody(body);

      if (!(audioFile instanceof File)) {
        return respondWithJsonError(
          c,
          { error: 'No audio file provided', code: 'RESPONSE_FAILED' },
          400,
        );
      }

      const transcription = await transcribeVoiceBuffer({
        buffer: await audioFile.arrayBuffer(),
        mimeType: audioFile.type,
        ...(audioFile.name ? { fileName: audioFile.name } : {}),
        ...(language ? { language } : {}),
      });

      const rawVoice = typeof body.voice === 'string' ? body.voice : 'alloy';
      const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
      type Voice = (typeof VALID_VOICES)[number];
      const voice: Voice = (VALID_VOICES as readonly string[]).includes(rawVoice)
        ? (rawVoice as Voice)
        : 'alloy';

      const systemPrompt =
        typeof body.systemPrompt === 'string'
          ? body.systemPrompt
          : 'You are a helpful assistant. Respond naturally in the same language as the user.';

      const { audioBuffer, mimeType, transcript } = await generateVoiceResponse({
        text: transcription.text,
        voice,
        format: 'pcm16' as const,
        systemPrompt,
      });

      const ab = audioBuffer.buffer.slice(
        audioBuffer.byteOffset,
        audioBuffer.byteOffset + audioBuffer.byteLength,
      ) as ArrayBuffer;
      const uint8 = new Uint8Array(ab);
      return c.newResponse(uint8, 200, {
        'Content-Type': mimeType,
        'Content-Length': String(uint8.byteLength),
        'X-User-Transcript': encodeURIComponent(transcription.text),
        'X-AI-Transcript': encodeURIComponent(transcript),
      });
    } catch (error) {
      if (error instanceof VoiceError) {
        return respondWithJsonError(
          c,
          { error: error.message, code: error.code as VoiceErrorOutput['code'] },
          getVoiceErrorStatusCode(error.statusCode),
        );
      }
      return respondWithJsonError(
        c,
        { error: 'Failed to generate voice response', code: 'RESPONSE_FAILED' },
        500,
      );
    }
  });

authenticatedVoiceRoutes.post('/respond/stream', async (c) => {
  try {
    const body = await c.req.parseBody();
    const { audioFile, language } = parseVoiceRequestBody(body);

    if (!(audioFile instanceof File)) {
      return respondWithJsonError(
        c,
        { error: 'No audio file provided', code: 'RESPONSE_FAILED' },
        400,
      );
    }

    const transcription = await transcribeVoiceBuffer({
      buffer: await audioFile.arrayBuffer(),
      mimeType: audioFile.type,
      ...(audioFile.name ? { fileName: audioFile.name } : {}),
      ...(language ? { language } : {}),
    });

    const rawVoice = typeof body.voice === 'string' ? body.voice : 'alloy';
    const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
    type Voice = (typeof VALID_VOICES)[number];
    const voice: Voice = (VALID_VOICES as readonly string[]).includes(rawVoice)
      ? (rawVoice as Voice)
      : 'alloy';

    const systemPrompt =
      typeof body.systemPrompt === 'string'
        ? body.systemPrompt
        : 'You are a helpful assistant. Respond naturally in the same language as the user.';

    const { stream, transcript, mimeType } = await generateVoiceResponseStream({
      text: transcription.text,
      voice,
      format: 'pcm16' as const,
      systemPrompt,
    });

    c.executionCtx.waitUntil(
      transcript.catch(() => {
        // Stream transport only needs the audio response.
      }),
    );

    return c.body(stream, 200, {
      'Content-Type': mimeType,
      'X-User-Transcript': encodeURIComponent(transcription.text),
    });
  } catch (error) {
    if (error instanceof VoiceError) {
      return respondWithJsonError(
        c,
        { error: error.message, code: error.code as VoiceErrorOutput['code'] },
        getVoiceErrorStatusCode(error.statusCode),
      );
    }
    return respondWithJsonError(
      c,
      { error: 'Failed to generate voice response', code: 'RESPONSE_FAILED' },
      500,
    );
  }
});
