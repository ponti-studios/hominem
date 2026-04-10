import { Buffer } from 'node:buffer';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { logger } from '@hominem/utils/logger';

import { env } from './env';
import {
  VoiceError,
  getVoiceAudioDir,
  getVoiceLogData,
  mapVoiceProviderError,
} from './voice-errors';

export { VoiceError } from './voice-errors';
export type { VoiceErrorCode } from './voice-errors';

export const VOICE_TRANSCRIPTION_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export const VOICE_TRANSCRIPTION_SUPPORTED_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
] as const;

type VoiceMimeType = (typeof VOICE_TRANSCRIPTION_SUPPORTED_TYPES)[number];

export interface VoiceTranscriptionOutput {
  text: string;
  language?: string;
  duration?: number;
  words?: unknown[];
  segments?: unknown[];
  savedPath?: string | undefined;
}

export const VOICE_TRANSPORTS = ['hono-rpc'] as const;
export type VoiceTransport = (typeof VOICE_TRANSPORTS)[number];

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
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function normalizeVoiceMimeType(mimeType: string): string {
  const [baseType] = mimeType.split(';', 1);
  const normalized = baseType?.trim().toLowerCase() ?? '';
  return VOICE_MIME_ALIASES[normalized] ?? normalized;
}

export function getVoiceFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
  };
  return mimeToExt[mimeType] || '.webm';
}

function throwTranscriptionError(error: unknown): never {
  if (error instanceof VoiceError) throw error;
  if (error instanceof Error) {
    if (error.message.includes('quota')) {
      throw new VoiceError('API quota exceeded. Please try again later.', 'QUOTA', 429);
    }
    if (error.message.includes('API key') || error.message.includes('401')) {
      throw new VoiceError('Invalid API configuration.', 'AUTH', 401);
    }
    throw new VoiceError(`Transcription failed: ${error.message}`, 'TRANSCRIBE_FAILED', 500);
  }
  throw new VoiceError('Failed to transcribe audio', 'TRANSCRIBE_FAILED', 500);
}

export function validateVoiceInput(input: { mimeType: string; size: number }) {
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

export async function transcribeVoiceBuffer(input: {
  buffer: ArrayBuffer;
  mimeType: string;
  fileName?: string;
  language?: string;
  requestId?: string;
}): Promise<VoiceTranscriptionOutput> {
  const startTime = performance.now();
  const requestId = input.requestId ?? `vt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const normalizedMimeType = validateVoiceInput({
    mimeType: input.mimeType,
    size: input.buffer.byteLength,
  });

  if (!env.OPENROUTER_API_KEY) {
    logger.error('[voice-transcription] Missing OPENROUTER_API_KEY', getVoiceLogData(requestId));
    throw new VoiceError('Invalid API configuration.', 'AUTH', 401);
  }

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

  let savedPath: string | undefined;
  if (env.SAVE_VOICE_AUDIO === true) {
    try {
      const ext = getVoiceFileExtension(normalizedMimeType).slice(1);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `voice_in_${timestamp}.${ext}`;
      const audioDir = getVoiceAudioDir();
      savedPath = join(audioDir, filename);
      const buffer = Buffer.from(input.buffer);
      await writeFile(savedPath, buffer);
      logger.info('[voice-transcription] Input audio saved for review', {
        ...getVoiceLogData(requestId),
        savedPath,
        size: buffer.length,
      });
    } catch (saveError) {
      logger.warn('[voice-transcription] Failed to save input audio', {
        ...getVoiceLogData(requestId),
        error: saveError instanceof Error ? saveError.message : 'Unknown',
      });
    }
  }

  const audioFormat = MIME_TO_OPENROUTER_FORMAT[normalizedMimeType] ?? 'mp3';
  const base64Audio = Buffer.from(input.buffer).toString('base64');

  const messages: object[] = [
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
          input_audio: { data: base64Audio, format: audioFormat },
        },
      ],
    },
  ];

  let response!: Response;
  let responseTime!: number;

  try {
    const fetchStart = performance.now();
    response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hominem.app',
        'X-Title': 'Hominem',
      },
      body: JSON.stringify({ model: TRANSCRIPTION_MODEL, messages }),
    });
    responseTime = performance.now() - fetchStart;
  } catch (error) {
    const errorTime = performance.now() - startTime;
    logger.error('[voice-transcription] Fetch failed', {
      ...getVoiceLogData(requestId),
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Math.round(errorTime),
    });
    throwTranscriptionError(error);
  }

  logger.info('[voice-transcription] HTTP response received', {
    ...getVoiceLogData(requestId),
    status: response.status,
    statusText: response.statusText,
    responseTimeMs: Math.round(responseTime),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errorMessage = (errorBody['error'] as Record<string, unknown>)?.['message'] as
      | string
      | undefined;
    const totalTime = performance.now() - startTime;

    logger.error('[voice-transcription] API error response', {
      ...getVoiceLogData(requestId),
      status: response.status,
      error: errorMessage ?? response.statusText,
      totalDurationMs: Math.round(totalTime),
    });

    const errorInfo = mapVoiceProviderError({
      kind: 'transcription',
      responseStatus: response.status,
      responseStatusText: response.statusText,
      ...(typeof errorMessage === 'string' ? { errorMessage } : {}),
    });
    throw new VoiceError(errorInfo.message, errorInfo.code, errorInfo.statusCode);
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
      error: error instanceof Error ? error.message : 'Unknown error',
      totalDurationMs: Math.round(totalTime),
    });
    throwTranscriptionError(error);
  }
}
