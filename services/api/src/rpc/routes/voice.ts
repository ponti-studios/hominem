import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  MobileVoiceResponseErrorOutput,
  MobileVoiceTranscriptionErrorOutput,
  MobileVoiceTranscriptionOutput,
} from '@hominem/rpc/types/mobile.types';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import * as z from 'zod';

import { env } from '../../env';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';

type VoiceErrorOutput = MobileVoiceResponseErrorOutput | MobileVoiceTranscriptionErrorOutput;

type VoiceErrorStatusCode = 400 | 401 | 429 | 500;

const VOICE_ERROR_CODES = [
  'INVALID_FORMAT',
  'TOO_LARGE',
  'AUTH',
  'QUOTA',
  'CONTENT_POLICY',
  'TRANSCRIBE_FAILED',
  'RESPONSE_FAILED',
  'SPEECH_FAILED',
] as const;

type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];

class VoiceError extends Error {
  code: VoiceErrorCode;
  statusCode: number;

  constructor(message: string, code: VoiceErrorCode, statusCode = 500) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeVoiceErrorStatusCode(statusCode: number): 400 | 401 | 429 | 500 {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

function mapVoiceProviderError(input: {
  kind: 'response' | 'transcription' | 'speech';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): { code: VoiceErrorCode; message: string; statusCode: 400 | 401 | 429 | 500 } {
  if (input.responseStatus === 401 || input.responseStatus === 403) {
    return { code: 'AUTH', message: 'Invalid API configuration.', statusCode: 401 };
  }

  if (input.responseStatus === 429) {
    return {
      code: 'QUOTA',
      message: 'API quota exceeded. Please try again later.',
      statusCode: 429,
    };
  }

  if (input.responseStatus === 400 && input.errorMessage?.includes('content_policy')) {
    return {
      code: 'CONTENT_POLICY',
      message:
        input.kind === 'speech'
          ? 'Text content not allowed by content policy.'
          : 'Content not allowed by content policy.',
      statusCode: 400,
    };
  }

  const failCode: VoiceErrorCode =
    input.kind === 'response'
      ? 'RESPONSE_FAILED'
      : input.kind === 'transcription'
        ? 'TRANSCRIBE_FAILED'
        : 'SPEECH_FAILED';

  const label =
    input.kind === 'response'
      ? 'Voice response'
      : input.kind === 'transcription'
        ? 'Transcription'
        : 'Speech generation';

  return {
    code: failCode,
    message: `${label} failed: ${input.errorMessage ?? input.responseStatusText}`,
    statusCode: normalizeVoiceErrorStatusCode(input.responseStatus),
  };
}

function getVoiceLogData(requestId: string, data?: object) {
  let spanCtx: { trace_id?: string; span_id?: string } = {};
  try {
    const { context, trace } = require('@opentelemetry/api') as {
      context: { active: () => unknown };
      trace: {
        getSpan: (
          ctx: unknown,
        ) =>
          | { spanContext: () => { isValid: boolean; traceId: string; spanId: string } }
          | undefined;
      };
    };
    const span = trace.getSpan(context.active());
    if (span) {
      const sc = span.spanContext();
      if (sc.isValid) spanCtx = { trace_id: sc.traceId, span_id: sc.spanId };
    }
  } catch {}
  if (!data) return { requestId, ...spanCtx };
  return { requestId, ...spanCtx, ...data };
}

function getVoiceAudioDir(): string {
  const candidates = ['./.tmp/voice', '../.tmp/voice', '../../.tmp/voice', '../../../.tmp/voice'];
  for (const p of candidates) {
    const dir = p.replace('/voice', '');
    if (existsSync(dir) || existsSync(p)) return p;
  }
  return './.tmp/voice';
}

const VOICE_TRANSCRIPTION_SUPPORTED_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
] as const;

type VoiceMimeType = (typeof VOICE_TRANSCRIPTION_SUPPORTED_TYPES)[number];
const VOICE_TRANSCRIPTION_MAX_SIZE_BYTES = 25 * 1024 * 1024;
const VOICE_MIME_ALIASES: Record<string, string> = {
  'audio/x-wav': 'audio/wav',
  'audio/m4a': 'audio/mp4',
};
const MIME_TO_OPENROUTER_FORMAT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
};
const TRANSCRIPTION_MODEL = 'google/gemini-2.5-flash-lite';
const VOICE_RESPONSE_MODEL = 'openai/gpt-4o-audio-preview';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function normalizeVoiceMimeType(mimeType: string): string {
  const [baseType] = mimeType.split(';', 1);
  const normalized = baseType?.trim().toLowerCase() ?? '';
  return VOICE_MIME_ALIASES[normalized] ?? normalized;
}

function getVoiceFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
  };
  return mimeToExt[mimeType] || '.webm';
}

function validateVoiceInput(input: { mimeType: string; size: number }) {
  const normalizedMimeType = normalizeVoiceMimeType(input.mimeType);

  if (!VOICE_TRANSCRIPTION_SUPPORTED_TYPES.includes(normalizedMimeType as VoiceMimeType)) {
    throw new VoiceError(
      `Unsupported audio format: ${input.mimeType}. Supported formats: ${VOICE_TRANSCRIPTION_SUPPORTED_TYPES.join(', ')}`,
      'INVALID_FORMAT',
      400,
    );
  }

  if (input.size > VOICE_TRANSCRIPTION_MAX_SIZE_BYTES) {
    throw new VoiceError(
      `File too large. Maximum size is ${VOICE_TRANSCRIPTION_MAX_SIZE_BYTES / (1024 * 1024)}MB`,
      'TOO_LARGE',
      400,
    );
  }

  return normalizedMimeType;
}

function createVoiceRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  return error instanceof Error ? error.message : fallback;
}

function requireOpenRouterApiKey(logPrefix: string, requestId: string): string {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (apiKey) return apiKey;

  logger.error(`${logPrefix} Missing OPENROUTER_API_KEY`, getVoiceLogData(requestId));
  throw new VoiceError('Invalid API configuration.', 'AUTH', 401);
}

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://hominem.app',
    'X-Title': 'Hominem',
  };
}

async function postOpenRouterChatCompletion(apiKey: string, body: object): Promise<Response> {
  return fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

async function getVoiceProviderErrorMessage(response: Response): Promise<string | undefined> {
  const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const error = errorBody['error'] as Record<string, unknown> | undefined;
  const message = error?.['message'];
  return typeof message === 'string' ? message : undefined;
}

async function throwVoiceProviderError(input: {
  kind: 'response' | 'transcription' | 'speech';
  logPrefix: string;
  requestId: string;
  response: Response;
  startTime?: number;
}): Promise<never> {
  const errorMessage = await getVoiceProviderErrorMessage(input.response);
  const totalTime = input.startTime ? performance.now() - input.startTime : undefined;

  logger.error(`${input.logPrefix} API error response`, {
    ...getVoiceLogData(input.requestId),
    status: input.response.status,
    error: errorMessage ?? input.response.statusText,
    ...(totalTime === undefined ? {} : { totalDurationMs: Math.round(totalTime) }),
  });

  const errorInfo = mapVoiceProviderError({
    kind: input.kind,
    responseStatus: input.response.status,
    responseStatusText: input.response.statusText,
    ...(errorMessage ? { errorMessage } : {}),
  });
  throw new VoiceError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
}

function toTranscriptionVoiceError(error: unknown): VoiceError {
  if (error instanceof VoiceError) return error;

  if (error instanceof Error) {
    if (error.message.includes('quota')) {
      return new VoiceError('API quota exceeded. Please try again later.', 'QUOTA', 429);
    }
    if (error.message.includes('API key') || error.message.includes('401')) {
      return new VoiceError('Invalid API configuration.', 'AUTH', 401);
    }
    return new VoiceError(`Transcription failed: ${error.message}`, 'TRANSCRIBE_FAILED', 500);
  }

  return new VoiceError('Failed to transcribe audio', 'TRANSCRIBE_FAILED', 500);
}

async function saveTranscriptionAudio(input: {
  buffer: ArrayBuffer;
  mimeType: string;
  requestId: string;
}): Promise<string | undefined> {
  if (env.SAVE_VOICE_AUDIO !== true) return undefined;

  try {
    const ext = getVoiceFileExtension(input.mimeType).slice(1);
    const filename = generateVoiceAudioFilename('voice_in', ext);
    const audioDir = getVoiceAudioDir();
    const savedPath = join(audioDir, filename);
    const buffer = Buffer.from(input.buffer);
    await writeFile(savedPath, buffer);
    logger.info('[voice-transcription] Input audio saved for review', {
      ...getVoiceLogData(input.requestId),
      savedPath,
      size: buffer.length,
    });
    return savedPath;
  } catch (saveError) {
    logger.warn('[voice-transcription] Failed to save input audio', {
      ...getVoiceLogData(input.requestId),
      error: getErrorMessage(saveError, 'Unknown'),
    });
    return undefined;
  }
}

function generateVoiceAudioFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
}

function getTranscriptionMessages(input: {
  base64Audio: string;
  audioFormat: string;
  language?: string;
}): object[] {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: input.language
            ? `Please transcribe this audio file exactly. The spoken language is ${input.language}.`
            : 'Please transcribe this audio file exactly. Return only the transcript, no commentary.',
        },
        {
          type: 'input_audio',
          input_audio: { data: input.base64Audio, format: input.audioFormat },
        },
      ],
    },
  ];
}

async function transcribeVoiceBuffer(input: {
  buffer: ArrayBuffer;
  mimeType: string;
  fileName?: string;
  language?: string;
  requestId?: string;
}) {
  const startTime = performance.now();
  const requestId = input.requestId ?? createVoiceRequestId('vt');

  const normalizedMimeType = validateVoiceInput({
    mimeType: input.mimeType,
    size: input.buffer.byteLength,
  });

  const apiKey = requireOpenRouterApiKey('[voice-transcription]', requestId);

  logger.info('[voice-transcription] Request started', {
    ...getVoiceLogData(requestId),
    model: TRANSCRIPTION_MODEL,
    mimeType: input.mimeType,
    normalizedMimeType,
    sizeBytes: input.buffer.byteLength,
    sizeKb: Math.round(input.buffer.byteLength / 1024),
    fileName: input.fileName,
    hasLanguageHint: !!input.language,
    language: input.language,
  });

  const savedPath = await saveTranscriptionAudio({
    buffer: input.buffer,
    mimeType: normalizedMimeType,
    requestId,
  });

  const audioFormat = MIME_TO_OPENROUTER_FORMAT[normalizedMimeType] ?? 'mp3';
  const base64Audio = Buffer.from(input.buffer).toString('base64');
  const messages = getTranscriptionMessages({ base64Audio, audioFormat, language: input.language });

  let response: Response;
  let responseTime: number;

  try {
    const fetchStart = performance.now();
    response = await postOpenRouterChatCompletion(apiKey, { model: TRANSCRIPTION_MODEL, messages });
    responseTime = performance.now() - fetchStart;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    logger.error('[voice-transcription] Fetch failed', {
      ...getVoiceLogData(requestId),
      error: getErrorMessage(error),
      durationMs: Math.round(errorTime),
    });
    throw toTranscriptionVoiceError(error);
  }

  logger.info('[voice-transcription] HTTP response received', {
    ...getVoiceLogData(requestId),
    status: response.status,
    statusText: response.statusText,
    responseTimeMs: Math.round(responseTime),
  });

  if (!response.ok) {
    await throwVoiceProviderError({
      kind: 'transcription',
      logPrefix: '[voice-transcription]',
      requestId,
      response,
      startTime,
    });
  }

  try {
    const parseStart = performance.now();
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    const parseTime = performance.now() - parseStart;
    const totalTime = performance.now() - startTime;

    if (!text) {
      logger.warn('[voice-transcription] Empty transcript received', {
        ...getVoiceLogData(requestId),
        totalDurationMs: Math.round(totalTime),
      });
    }

    logger.info('[voice-transcription] Request completed successfully', {
      ...getVoiceLogData(requestId),
      transcriptLength: text.length,
      transcriptPreview: text.slice(0, 150),
      parseTimeMs: Math.round(parseTime),
      totalTimeMs: Math.round(totalTime),
      savedPath,
    });

    return { text, savedPath };
  } catch (error) {
    const totalTime = performance.now() - startTime;

    if (error instanceof VoiceError) {
      logger.error('[voice-transcription] Processing error', {
        ...getVoiceLogData(requestId),
        code: error.code,
        totalDurationMs: Math.round(totalTime),
      });
      throw error;
    }

    logger.error('[voice-transcription] Unexpected error', {
      ...getVoiceLogData(requestId),
      error: getErrorMessage(error),
      totalDurationMs: Math.round(totalTime),
    });
    throw toTranscriptionVoiceError(error);
  }
}

type VoiceResponseVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
type VoiceResponseFormat = 'pcm16';

const FORMAT_TO_MIME: Record<VoiceResponseFormat, string> = {
  pcm16: 'audio/pcm',
};

interface AudioChunk {
  choices?: Array<{
    delta?: {
      audio?: {
        data?: string;
        transcript?: string;
      };
    };
    finish_reason?: string | null;
  }>;
}

async function collectAudioStream(
  response: Response,
): Promise<{ audioB64: string; transcript: string }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new VoiceError('No response body from audio stream', 'RESPONSE_FAILED', 500);
  }

  const decoder = new TextDecoder();
  const audioChunks: string[] = [];
  const transcriptChunks: string[] = [];
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
          if (audio?.transcript) transcriptChunks.push(audio.transcript);
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    audioB64: audioChunks.join(''),
    transcript: transcriptChunks.join(''),
  };
}

function generateAudioFilename(prefix: string, format: VoiceResponseFormat): string {
  return generateVoiceAudioFilename(prefix, format === 'pcm16' ? 'pcm' : 'pcm');
}

function getVoiceResponseMessages(input: { text: string; systemPrompt?: string }): object[] {
  const messages: object[] = [];

  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt });
  }

  messages.push({ role: 'user', content: input.text });
  return messages;
}

function getVoiceResponseBody(input: {
  messages: object[];
  voice: VoiceResponseVoice;
  format: VoiceResponseFormat;
}) {
  return {
    model: VOICE_RESPONSE_MODEL,
    messages: input.messages,
    modalities: ['text', 'audio'],
    audio: { voice: input.voice, format: input.format },
    stream: true,
  };
}

async function saveVoiceResponseAudio(input: {
  audioBuffer: Buffer;
  format: VoiceResponseFormat;
  requestId: string;
}): Promise<string | undefined> {
  if (env.SAVE_VOICE_AUDIO !== true) return undefined;

  try {
    const filename = generateAudioFilename('voice_out', input.format);
    const audioDir = getVoiceAudioDir();
    const savedPath = join(audioDir, filename);
    await writeFile(savedPath, input.audioBuffer);
    logger.info('[voice-response] Audio saved for review', {
      ...getVoiceLogData(input.requestId),
      savedPath,
      size: input.audioBuffer.length,
    });
    return savedPath;
  } catch (saveError) {
    logger.warn('[voice-response] Failed to save audio file', {
      ...getVoiceLogData(input.requestId),
      error: getErrorMessage(saveError, 'Unknown'),
    });
    return undefined;
  }
}

function toVoiceResponseRequestError(error: unknown): VoiceError {
  if (error instanceof VoiceError) return error;
  if (error instanceof Error) {
    return new VoiceError(
      `Voice response request failed: ${error.message}`,
      'RESPONSE_FAILED',
      500,
    );
  }
  return new VoiceError('Voice response request failed', 'RESPONSE_FAILED', 500);
}

function toVoiceResponseStreamError(error: unknown): VoiceError {
  if (error instanceof VoiceError) return error;
  if (error instanceof Error) {
    return new VoiceError(
      `Failed to process audio stream: ${error.message}`,
      'RESPONSE_FAILED',
      500,
    );
  }
  return new VoiceError('Failed to process audio stream', 'RESPONSE_FAILED', 500);
}

async function generateVoiceResponse(input: {
  text: string;
  voice: VoiceResponseVoice;
  format: VoiceResponseFormat;
  systemPrompt?: string;
  requestId?: string;
}) {
  const startTime = performance.now();
  const requestId = input.requestId ?? createVoiceRequestId('vr');
  const apiKey = requireOpenRouterApiKey('[voice-response]', requestId);

  const voice: VoiceResponseVoice = input.voice ?? 'alloy';
  const format = input.format ?? 'pcm16';
  const mimeType = FORMAT_TO_MIME[format];
  const messages = getVoiceResponseMessages({
    text: input.text,
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
  });

  logger.info('[voice-response] Request started', {
    ...getVoiceLogData(requestId),
    model: VOICE_RESPONSE_MODEL,
    textLength: input.text.length,
    textPreview: input.text.slice(0, 100),
    voice,
    format: input.format,
    hasSystemPrompt: !!input.systemPrompt,
    messageCount: messages.length,
  });

  let response: Response;
  let responseTime: number;

  try {
    const fetchStart = performance.now();
    response = await postOpenRouterChatCompletion(
      apiKey,
      getVoiceResponseBody({ messages, voice, format }),
    );
    responseTime = performance.now() - fetchStart;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    logger.error('[voice-response] Fetch failed', {
      ...getVoiceLogData(requestId),
      error: getErrorMessage(error),
      durationMs: Math.round(errorTime),
    });
    throw toVoiceResponseRequestError(error);
  }

  logger.info('[voice-response] HTTP response received', {
    ...getVoiceLogData(requestId),
    status: response.status,
    statusText: response.statusText,
    responseTimeMs: Math.round(responseTime),
  });

  if (!response.ok) {
    await throwVoiceProviderError({
      kind: 'response',
      logPrefix: '[voice-response]',
      requestId,
      response,
      startTime,
    });
  }

  try {
    const streamStart = performance.now();
    const { audioB64, transcript } = await collectAudioStream(response);
    const streamTime = performance.now() - streamStart;
    const totalTime = performance.now() - startTime;

    if (!audioB64) {
      logger.error('[voice-response] No audio data in stream', {
        ...getVoiceLogData(requestId),
        totalDurationMs: Math.round(totalTime),
      });
      throw new VoiceError('No audio data received from model', 'RESPONSE_FAILED', 500);
    }

    const audioBuffer = Buffer.from(audioB64, 'base64');
    const savedPath = await saveVoiceResponseAudio({ audioBuffer, format, requestId });

    logger.info('[voice-response] Request completed successfully', {
      ...getVoiceLogData(requestId),
      transcriptLength: transcript.length,
      transcriptPreview: transcript.slice(0, 150),
      audioSizeBytes: audioBuffer.length,
      audioSizeKb: Math.round(audioBuffer.length / 1024),
      streamTimeMs: Math.round(streamTime),
      totalTimeMs: Math.round(totalTime),
      savedPath,
    });

    return {
      audioBuffer,
      mimeType,
      transcript,
      savedPath,
    };
  } catch (error) {
    const totalTime = performance.now() - startTime;

    if (error instanceof VoiceError) {
      logger.error('[voice-response] Stream processing error', {
        ...getVoiceLogData(requestId),
        code: error.code,
        totalDurationMs: Math.round(totalTime),
      });
      throw error;
    }

    logger.error('[voice-response] Unexpected stream error', {
      ...getVoiceLogData(requestId),
      error: getErrorMessage(error),
      totalDurationMs: Math.round(totalTime),
    });

    throw toVoiceResponseStreamError(error);
  }
}

function createAudioStream(response: Response) {
  const transcriptChunks: string[] = [];
  let resolveTranscript!: (transcript: string) => void;
  let rejectTranscript!: (error: unknown) => void;

  const transcript = new Promise<string>((resolve, reject) => {
    resolveTranscript = resolve;
    rejectTranscript = reject;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        const error = new VoiceError('No response body from audio stream', 'RESPONSE_FAILED', 500);
        rejectTranscript(error);
        controller.error(error);
        return;
      }

      const decoder = new TextDecoder();
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
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as AudioChunk;
              const audio = chunk.choices?.[0]?.delta?.audio;
              if (audio?.data) {
                controller.enqueue(Buffer.from(audio.data, 'base64'));
              }
              if (audio?.transcript) {
                transcriptChunks.push(audio.transcript);
              }
            } catch {}
          }
        }

        const final = decoder.decode();
        if (final) {
          buffer += final;
        }

        resolveTranscript(transcriptChunks.join(''));
        controller.close();
      } catch (error) {
        rejectTranscript(error);
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return {
    stream,
    transcript,
    mimeType: 'audio/pcm',
  };
}

async function generateVoiceResponseStream(input: {
  text: string;
  voice: VoiceResponseVoice;
  format: VoiceResponseFormat;
  systemPrompt?: string;
  requestId?: string;
}) {
  const requestId = input.requestId ?? `vr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const apiKey = requireOpenRouterApiKey('[voice-response]', requestId);

  const voice: VoiceResponseVoice = input.voice ?? 'alloy';
  const messages: object[] = [];

  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt });
  }

  messages.push({ role: 'user', content: input.text });

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hominem.app',
      'X-Title': 'Hominem',
    },
    body: JSON.stringify({
      model: VOICE_RESPONSE_MODEL,
      messages,
      modalities: ['text', 'audio'],
      audio: { voice, format: 'pcm16' },
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = (errorBody['error'] as Record<string, unknown>)?.['message'] as
      | string
      | undefined;

    const errorInfo = mapVoiceProviderError({
      kind: 'response',
      responseStatus: response.status,
      responseStatusText: response.statusText,
      ...(typeof errorMessage === 'string' ? { errorMessage } : {}),
    });
    throw new VoiceError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
  }

  return createAudioStream(response);
}

async function collectSpeechStream(response: Response): Promise<Buffer> {
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
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  const audioB64 = audioChunks.join('');
  return Buffer.from(audioB64, 'base64');
}

async function generateSpeechBuffer(input: { text: string; voice: string; speed: number }) {
  const requestId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const apiKey = requireOpenRouterApiKey('[voice-speech]', requestId);

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
        Authorization: `Bearer ${apiKey}`,
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
      kind: 'speech',
      responseStatus: response.status,
      responseStatusText: response.statusText,
      ...(typeof errorMessage === 'string' ? { errorMessage } : {}),
    });
    throw new VoiceError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
  }

  try {
    const audioBuffer = await collectSpeechStream(response);

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

function isErrorWithMessage(error: unknown): error is Error {
  return error instanceof Error;
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
    rateLimitMiddleware({
      bucket: 'voice-respond-stream',
      identifier: 'respond-stream',
      windowSec: 60,
      max: 20,
    }),
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
        return c.json(
          { error: isErrorWithMessage(error) ? error.message : 'Failed to generate speech' },
          500,
        );
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
        {
          error: isErrorWithMessage(error) ? error.message : 'Failed to generate voice response',
          code: 'RESPONSE_FAILED',
        },
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
      {
        error: isErrorWithMessage(error) ? error.message : 'Failed to generate voice response',
        code: 'RESPONSE_FAILED',
      },
      500,
    );
  }
});
