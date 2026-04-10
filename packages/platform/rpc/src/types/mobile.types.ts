export type MobileVoiceErrorCode =
  | 'INVALID_FORMAT'
  | 'TOO_LARGE'
  | 'AUTH'
  | 'QUOTA'
  | 'CONTENT_POLICY'
  | 'TRANSCRIBE_FAILED'
  | 'RESPONSE_FAILED'
  | 'SPEECH_FAILED';

export interface MobileVoiceTranscriptionOutput {
  text: string;
  language?: string;
  duration?: number;
  words?: unknown[];
  segments?: unknown[];
}

export interface MobileVoiceTranscriptionErrorOutput {
  error: string;
  code: MobileVoiceErrorCode;
}

export interface MobileVoiceResponseErrorOutput {
  error: string;
  code: MobileVoiceErrorCode;
}
