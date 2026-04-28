import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import {
  VoiceError,
  generateSpeechBuffer,
  generateVoiceResponseStream,
  getVoiceErrorStatusCode,
  getVoiceLogData,
  getVoiceRequestContext,
  getVoiceResponseRequestOptions,
  handleVoiceRouteError,
  isErrorWithMessage,
  parseLoggedVoiceRequest,
  respondToInvalidVoiceMultipartBody,
  respondWithJsonError,
  transcribeVoiceBuffer,
} from './voice-helpers';

type MobileVoiceTranscriptionOutput = {
  text: string;
  language?: string;
  duration?: number;
  words?: unknown[];
  segments?: unknown[];
};

const voiceSpeechSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.string().default('alloy'),
  speed: z.number().min(0.25).max(4).default(1),
});

const voiceRoutes = new Hono<AppContext>().post('/transcribe', async (c) => {
  try {
    const { requestId, clientRequestId } = getVoiceRequestContext(c);
    const { body, audioFile, language } = await parseLoggedVoiceRequest(c, {
      requestId,
      clientRequestId,
      route: '/transcribe',
    });

    if (!(audioFile instanceof File)) {
      return respondToInvalidVoiceMultipartBody(c, {
        body,
        requestId,
        clientRequestId,
        route: '/transcribe',
        code: 'INVALID_FORMAT',
      });
    }

    const output = await transcribeVoiceBuffer({
      buffer: await audioFile.arrayBuffer(),
      mimeType: audioFile.type,
      ...(audioFile.name ? { fileName: audioFile.name } : {}),
      ...(language ? { language } : {}),
      requestId,
    });

    logger.info('[voice-transcription] request completed', {
      ...getVoiceLogData(requestId),
      clientRequestId,
      route: '/transcribe',
      transcriptLength: output.text.length,
      transcriptPreview: output.text.slice(0, 120),
    });

    const response: MobileVoiceTranscriptionOutput = {
      text: output.text,
    };

    return c.json(response);
  } catch (error) {
    const { requestId, clientRequestId } = getVoiceRequestContext(c);
    if (error instanceof VoiceError) {
      return handleVoiceRouteError(c, {
        error,
        requestId,
        clientRequestId,
        route: '/transcribe',
      });
    }
    logger.error('[voice-transcription] unexpected failure', {
      ...getVoiceLogData(requestId),
      clientRequestId,
      route: '/transcribe',
      error: isErrorWithMessage(error) ? error.message : 'Unknown error',
    });
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
    '/transcribe',
    rateLimitMiddleware({
      bucket: 'voice-transcribe',
      identifier: 'transcribe',
      windowSec: 60,
      max: 20,
    }),
  )
  .use(
    '/speech',
    rateLimitMiddleware({ bucket: 'voice-speech', identifier: 'speech', windowSec: 60, max: 30 }),
  )
  .use(
    '/respond/stream',
    rateLimitMiddleware({
      bucket: 'voice-respond-stream',
      identifier: 'respond-stream',
      windowSec: 60,
      max: 20,
    }),
  )
  .route('', voiceRoutes)
  .post('/speech', zValidator('json', voiceSpeechSchema), async (c) => {
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
      return c.json(
        { error: isErrorWithMessage(error) ? error.message : 'Failed to generate speech' },
        500,
      );
    }
  })
  .post('/respond/stream', async (c) => {
    try {
      const { requestId, clientRequestId } = getVoiceRequestContext(c);
      const { body, audioFile, language } = await parseLoggedVoiceRequest(c, {
        requestId,
        clientRequestId,
        route: '/respond/stream',
      });

      if (!(audioFile instanceof File)) {
        return respondToInvalidVoiceMultipartBody(c, {
          body,
          requestId,
          clientRequestId,
          route: '/respond/stream',
          code: 'RESPONSE_FAILED',
        });
      }

      const transcription = await transcribeVoiceBuffer({
        buffer: await audioFile.arrayBuffer(),
        mimeType: audioFile.type,
        ...(audioFile.name ? { fileName: audioFile.name } : {}),
        ...(language ? { language } : {}),
        requestId,
      });

      logger.info('[voice-response] transcription completed', {
        ...getVoiceLogData(requestId),
        clientRequestId,
        route: '/respond/stream',
        transcriptLength: transcription.text.length,
        transcriptPreview: transcription.text.slice(0, 120),
      });

      const { voice, systemPrompt } = getVoiceResponseRequestOptions(body);

      const { stream, transcript, mimeType } = await generateVoiceResponseStream({
        text: transcription.text,
        voice,
        format: 'pcm16' as const,
        systemPrompt,
        requestId,
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
      const { requestId, clientRequestId } = getVoiceRequestContext(c);
      if (error instanceof VoiceError) {
        return handleVoiceRouteError(c, {
          error,
          requestId,
          clientRequestId,
          route: '/respond/stream',
        });
      }
      logger.error('[voice-response] unexpected failure', {
        ...getVoiceLogData(requestId),
        clientRequestId,
        route: '/respond/stream',
        error: isErrorWithMessage(error) ? error.message : 'Unknown error',
      });
      return respondWithJsonError(
        c,
        {
          error: isErrorWithMessage(error) ? error.message : 'Failed to generate voice response',
          code: 'RESPONSE_FAILED',
        },
        500,
      );
    }
  });
