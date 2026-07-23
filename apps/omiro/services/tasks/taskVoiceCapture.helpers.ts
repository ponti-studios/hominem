import type { TaskVoiceCaptureErrorCode } from './taskVoiceCapture.types';

export interface TaskVoiceCaptureErrorPresentation {
  title: string;
  message: string;
}

export function getTaskVoiceCaptureErrorPresentation(
  code: TaskVoiceCaptureErrorCode,
): TaskVoiceCaptureErrorPresentation {
  switch (code) {
    case 'permission-denied':
      return {
        title: 'Microphone access required',
        message: 'Allow microphone and speech recognition access to add tasks by voice.',
      };
    case 'recording-failed':
      return {
        title: 'Voice recording failed',
        message: 'Omiro could not start recording right now.',
      };
    case 'transcription-failed':
      return {
        title: 'Voice transcription failed',
        message: 'The transcript could not be generated. The temporary recording was cleaned up.',
      };
    case 'creation-failed':
      return {
        title: "Couldn't create tasks",
        message: 'Your recording was transcribed, but the tasks could not be created.',
      };
  }
}
