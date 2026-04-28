import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { logger } from '@hominem/telemetry';
import { type Context } from 'hono';

import { env } from '../../env';
import { ServiceError, type ErrorCode } from '../errors';
import { type AppContext } from '../middleware/auth';

export type VoiceRequestRoute = '/transcribe' | '/respond/stream';
export type VoiceErrorStatusCode = 400 | 401 | 429 | 500;

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

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];
export type VoiceErrorOutput = { error: string; code: VoiceErrorCode };
export type VoiceResponseVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type VoiceResponseFormat = 'pcm16';

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

function getServiceErrorCodeForVoiceError(code: VoiceErrorCode): ErrorCode {
  switch (code) {
    case 'INVALID_FORMAT':
    case 'TOO_LARGE':
    case 'CONTENT_POLICY':
      return 'VALIDATION_ERROR';
    case 'AUTH':
      return 'UNAUTHORIZED';
    case 'QUOTA':
      return 'UNAVAILABLE';
    case 'TRANSCRIBE_FAILED':
    case 'RESPONSE_FAILED':
    case 'SPEECH_FAILED':
      return 'INTERNAL_ERROR';
  }
}

export class VoiceError extends ServiceError {
  voiceCode: VoiceErrorCode;

  constructor(message: string, voiceCode: VoiceErrorCode, statusCode: VoiceErrorStatusCode = 500) {
    super(message, getServiceErrorCodeForVoiceError(voiceCode), statusCode, { voiceCode });
    this.name = 'VoiceError';
    this.voiceCode = voiceCode;
    Object.setPrototypeOf(this, VoiceError.prototype);
  }
}

function normalizeVoiceErrorStatusCode(statusCode: number): VoiceErrorStatusCode {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

function mapVoiceProviderError(input: {
  kind: 'response' | 'transcription' | 'speech';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): { code: VoiceErrorCode; message: string; statusCode: VoiceErrorStatusCode } {
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

export function getVoiceLogData(requestId: string, data?: object) {
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
  for (const candidate of candidates) {
    const dir = candidate.replace('/voice', '');
    if (existsSync(dir) || existsSync(candidate)) return candidate;
  }
  return './.tmp/voice';
}

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

function generateVoiceAudioFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}_${timestamp}.${extension}`;
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

export async function transcribeVoiceBuffer(input: {
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
        code: error.voiceCode,
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

export async function generateVoiceResponseStream(input: {
  text: string;
  voice: VoiceResponseVoice;
  format: VoiceResponseFormat;
  systemPrompt?: string;
  requestId?: string;
}) {
  const requestId = input.requestId ?? createVoiceRequestId('vr');
  const apiKey = requireOpenRouterApiKey('[voice-response]', requestId);
  const voice: VoiceResponseVoice = input.voice ?? 'alloy';
  const format = input.format ?? 'pcm16';
  const messages = getVoiceResponseMessages({
    text: input.text,
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
  });

  let response: Response;

  try {
    response = await postOpenRouterChatCompletion(
      apiKey,
      getVoiceResponseBody({ messages, voice, format }),
    );
  } catch (error) {
    logger.error('[voice-response] Fetch failed', {
      ...getVoiceLogData(requestId),
      error: getErrorMessage(error),
    });
    throw toVoiceResponseRequestError(error);
  }

  if (!response.ok) {
    await throwVoiceProviderError({
      kind: 'response',
      logPrefix: '[voice-response]',
      requestId,
      response,
    });
  }

  try {
    return createAudioStream(response);
  } catch (error) {
    if (error instanceof VoiceError) throw error;
    throw toVoiceResponseStreamError(error);
  }
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

export async function generateSpeechBuffer(input: { text: string; voice: string; speed: number }) {
  const requestId = createVoiceRequestId('sp');
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
    response = await postOpenRouterChatCompletion(apiKey, {
      model,
      messages: [{ role: 'user', content: input.text }],
      modalities: ['audio'],
      audio: { voice: input.voice, format: 'mp3' },
      stream: true,
    });
  } catch (error) {
    logger.error('[voice-speech] Fetch failed', {
      requestId,
      error: getErrorMessage(error),
    });
    throw new VoiceError('Speech generation request failed', 'RESPONSE_FAILED', 500);
  }

  logger.info('[voice-speech] HTTP response received', {
    requestId,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    await throwVoiceProviderError({
      kind: 'speech',
      logPrefix: '[voice-speech]',
      requestId,
      response,
    });
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

export function getVoiceErrorStatusCode(statusCode: number): VoiceErrorStatusCode {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

export function respondWithJsonError(
  c: Context<AppContext>,
  body: VoiceErrorOutput,
  statusCode: VoiceErrorStatusCode,
): Response {
  return c.newResponse(JSON.stringify(body), statusCode, {
    'Content-Type': 'application/json',
  });
}

export function isErrorWithMessage(error: unknown): error is Error {
  return error instanceof Error;
}

export function getVoiceRequestContext(c: Context<AppContext>) {
  return {
    requestId: c.get('requestId') ?? createVoiceRequestId('vr'),
    clientRequestId: c.req.header('x-voice-request-id') ?? undefined,
  };
}

export function handleVoiceRouteError(
  c: Context<AppContext>,
  input: {
    error: VoiceError;
    requestId: string;
    clientRequestId?: string;
    route: VoiceRequestRoute;
  },
): Response {
  logger.error(
    input.route === '/transcribe'
      ? '[voice-transcription] request failed'
      : '[voice-response] request failed',
    {
      ...getVoiceLogData(input.requestId),
      clientRequestId: input.clientRequestId,
      route: input.route,
      code: input.error.voiceCode,
      statusCode: input.error.statusCode,
      message: input.error.message,
    },
  );

  return respondWithJsonError(
    c,
    { error: input.error.message, code: input.error.voiceCode },
    getVoiceErrorStatusCode(input.error.statusCode),
  );
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

function getVoiceRequestBodySummary(body: Record<string, unknown>) {
  const audioInput = body.audio;
  const audioValue = Array.isArray(audioInput) ? audioInput[0] : audioInput;

  return {
    bodyKeys: Object.keys(body),
    hasAudio: audioValue !== undefined,
    audioType: audioValue instanceof File ? 'File' : typeof audioValue,
    audioName: audioValue instanceof File ? audioValue.name : undefined,
    audioMimeType: audioValue instanceof File ? audioValue.type : undefined,
    audioSizeBytes: audioValue instanceof File ? audioValue.size : undefined,
    language: typeof body.language === 'string' ? body.language : undefined,
    voice: typeof body.voice === 'string' ? body.voice : undefined,
    systemPromptPresent:
      typeof body.systemPrompt === 'string' && body.systemPrompt.trim().length > 0,
  };
}

export async function parseLoggedVoiceRequest(
  c: Context<AppContext>,
  input: {
    requestId: string;
    clientRequestId?: string;
    route: VoiceRequestRoute;
  },
) {
  const body = (await c.req.parseBody()) as Record<string, unknown>;

  logger.info(
    `${input.route === '/transcribe' ? '[voice-transcription]' : '[voice-response]'} request received`,
    {
      ...getVoiceLogData(input.requestId),
      clientRequestId: input.clientRequestId,
      route: input.route,
      ...getVoiceRequestBodySummary(body),
    },
  );

  return {
    body,
    ...parseVoiceRequestBody(body),
  };
}

export function respondToInvalidVoiceMultipartBody(
  c: Context<AppContext>,
  input: {
    body: Record<string, unknown>;
    requestId: string;
    clientRequestId?: string;
    route: VoiceRequestRoute;
    code: VoiceErrorOutput['code'];
  },
) {
  logger.warn(
    input.route === '/transcribe'
      ? '[voice-transcription] invalid multipart body'
      : '[voice-response] invalid multipart body',
    {
      ...getVoiceLogData(input.requestId),
      clientRequestId: input.clientRequestId,
      route: input.route,
      ...getVoiceRequestBodySummary(input.body),
    },
  );

  return respondWithJsonError(c, { error: 'No audio file provided', code: input.code }, 400);
}

export function getVoiceResponseRequestOptions(body: Record<string, unknown>) {
  const rawVoice = typeof body.voice === 'string' ? body.voice : 'alloy';
  const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
  type ValidVoice = (typeof validVoices)[number];
  const voice: ValidVoice = (validVoices as readonly string[]).includes(rawVoice)
    ? (rawVoice as ValidVoice)
    : 'alloy';

  const systemPrompt =
    typeof body.systemPrompt === 'string'
      ? body.systemPrompt
      : 'You are a helpful assistant. Respond naturally in the same language as the user.';

  return { voice, systemPrompt };
}
