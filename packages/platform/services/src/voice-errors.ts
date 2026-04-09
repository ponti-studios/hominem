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

export type VoiceResponseErrorCode = Extract<
  VoiceErrorCode,
  'AUTH' | 'QUOTA' | 'CONTENT_POLICY' | 'RESPONSE_FAILED'
>;

export type VoiceTranscriptionErrorCode = Extract<
  VoiceErrorCode,
  'INVALID_FORMAT' | 'TOO_LARGE' | 'AUTH' | 'QUOTA' | 'TRANSCRIBE_FAILED'
>;

export type VoiceSpeechErrorCode = Extract<
  VoiceErrorCode,
  'AUTH' | 'QUOTA' | 'CONTENT_POLICY' | 'SPEECH_FAILED'
>;

export abstract class VoiceServiceError extends Error {
  statusCode: number;
  code: VoiceErrorCode;

  protected constructor(name: string, message: string, code: VoiceErrorCode, statusCode = 500) {
    super(message);
    this.name = name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class VoiceResponseError extends VoiceServiceError {
  declare code: VoiceResponseErrorCode;

  constructor(message: string, code: VoiceResponseErrorCode, statusCode = 500) {
    super('VoiceResponseError', message, code, statusCode);
  }
}

export class VoiceTranscriptionError extends VoiceServiceError {
  declare code: VoiceTranscriptionErrorCode;

  constructor(message: string, code: VoiceTranscriptionErrorCode, statusCode = 500) {
    super('VoiceTranscriptionError', message, code, statusCode);
  }
}

export class VoiceSpeechError extends VoiceServiceError {
  declare code: VoiceSpeechErrorCode;

  constructor(message: string, code: VoiceSpeechErrorCode, statusCode = 500) {
    super('VoiceSpeechError', message, code, statusCode);
  }
}

export function normalizeVoiceErrorStatusCode(statusCode: number): 400 | 401 | 429 | 500 {
  return statusCode === 400 || statusCode === 401 || statusCode === 429 ? statusCode : 500;
}

function getProviderFailureCode(kind: 'response' | 'transcription' | 'speech'): VoiceErrorCode {
  if (kind === 'response') return 'RESPONSE_FAILED';
  if (kind === 'transcription') return 'TRANSCRIBE_FAILED';
  return 'SPEECH_FAILED';
}

export function mapVoiceProviderError(input: {
  kind: 'response';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): {
  code: VoiceResponseErrorCode;
  message: string;
  statusCode: 400 | 401 | 429 | 500;
};

export function mapVoiceProviderError(input: {
  kind: 'transcription';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): {
  code: VoiceTranscriptionErrorCode;
  message: string;
  statusCode: 400 | 401 | 429 | 500;
};

export function mapVoiceProviderError(input: {
  kind: 'speech';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): {
  code: VoiceSpeechErrorCode;
  message: string;
  statusCode: 400 | 401 | 429 | 500;
};

export function mapVoiceProviderError(input: {
  kind: 'response' | 'transcription' | 'speech';
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string | undefined;
}): {
  code: VoiceErrorCode;
  message: string;
  statusCode: 400 | 401 | 429 | 500;
} {
  if (input.responseStatus === 401 || input.responseStatus === 403) {
    return {
      code: 'AUTH',
      message: 'Invalid API configuration.',
      statusCode: 401,
    };
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

  const label =
    input.kind === 'response'
      ? 'Voice response'
      : input.kind === 'transcription'
        ? 'Transcription'
        : 'Speech generation';

  return {
    code: getProviderFailureCode(input.kind),
    message: `${label} failed: ${input.errorMessage ?? input.responseStatusText}`,
    statusCode: normalizeVoiceErrorStatusCode(input.responseStatus),
  };
}
