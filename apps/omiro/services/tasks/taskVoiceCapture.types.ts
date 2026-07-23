export type TaskVoiceCaptureState = 'idle' | 'recording' | 'transcribing' | 'creating' | 'failed';

export type TaskVoiceCaptureErrorCode =
  | 'permission-denied'
  | 'recording-failed'
  | 'transcription-failed'
  | 'creation-failed';

export interface TaskVoiceCaptureError {
  code: TaskVoiceCaptureErrorCode;
  transcript?: string;
}
