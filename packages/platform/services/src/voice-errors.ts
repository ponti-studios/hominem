import { existsSync } from 'node:fs';

export const VOICE_ERROR_CODES = [
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

export class VoiceError extends Error {
  code: VoiceErrorCode;
  statusCode: number;

  constructor(message: string, code: VoiceErrorCode, statusCode = 500) {
    super(message);
    this.name = 'VoiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function normalizeVoiceErrorStatusCode(statusCode: number): 400 | 401 | 429 | 500 {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

export function mapVoiceProviderError(input: {
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

export function getVoiceAudioDir(): string {
  const candidates = ['./.tmp/voice', '../.tmp/voice', '../../.tmp/voice', '../../../.tmp/voice'];
  for (const p of candidates) {
    const dir = p.replace('/voice', '');
    if (existsSync(dir) || existsSync(p)) return p;
  }
  return './.tmp/voice';
}
