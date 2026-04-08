import { existsSync } from 'node:fs';

export type VoiceProviderErrorCode =
  | 'AUTH'
  | 'QUOTA'
  | 'CONTENT_POLICY'
  | 'RESPONSE_FAILED'
  | 'TRANSCRIBE_FAILED';

export interface VoiceProviderErrorInfo {
  code: VoiceProviderErrorCode;
  message: string;
  statusCode: number;
}

export function logAndMapVoiceProviderError(input: {
  logger: { error: (message: string, data?: object) => void };
  loggerLabel: string;
  requestId: string;
  responseStatus: number;
  responseStatusText: string;
  errorMessage?: string;
  kind: 'response' | 'transcription';
  totalDurationMs: number;
}): VoiceProviderErrorInfo {
  input.logger.error(input.loggerLabel, {
    requestId: input.requestId,
    status: input.responseStatus,
    error: input.errorMessage ?? input.responseStatusText,
    totalDurationMs: Math.round(input.totalDurationMs),
  });

  return getVoiceProviderErrorInfo({
    kind: input.kind,
    status: input.responseStatus,
    errorMessage: input.errorMessage,
    responseStatusText: input.responseStatusText,
  });
}

export function getVoiceAudioDir(): string {
  const possiblePaths = [
    './.tmp/voice',
    '../.tmp/voice',
    '../../.tmp/voice',
    '../../../.tmp/voice',
  ];

  for (const path of possiblePaths) {
    const dir = path.replace('/voice', '');
    if (existsSync(dir) || existsSync(path)) {
      return path;
    }
  }

  return './.tmp/voice';
}

function getVoiceProviderErrorInfo(input: {
  errorMessage?: string;
  responseStatusText: string;
  status: number;
  kind: 'response' | 'transcription';
}): VoiceProviderErrorInfo {
  if (input.status === 401 || input.status === 403) {
    return {
      code: 'AUTH',
      message: 'Invalid API configuration.',
      statusCode: 401,
    };
  }

  if (input.status === 429) {
    return {
      code: 'QUOTA',
      message: 'API quota exceeded. Please try again later.',
      statusCode: 429,
    };
  }

  if (
    input.kind === 'response' &&
    input.status === 400 &&
    input.errorMessage?.includes('content_policy')
  ) {
    return {
      code: 'CONTENT_POLICY',
      message: 'Content not allowed by content policy.',
      statusCode: 400,
    };
  }

  return {
    code: input.kind === 'response' ? 'RESPONSE_FAILED' : 'TRANSCRIBE_FAILED',
    message:
      input.kind === 'response'
        ? `Voice response failed: ${input.errorMessage ?? input.responseStatusText}`
        : `Transcription failed: ${input.errorMessage ?? input.responseStatusText}`,
    statusCode: 500,
  };
}
