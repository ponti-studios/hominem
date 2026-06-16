import type { RecorderState } from '~/components/media/audio.service';

export type VoiceComposerState = 'idle' | 'recording' | 'transcribing' | 'cleaning' | 'failed';

export type VoiceComposerErrorCode =
  | 'permission-denied'
  | 'recording-failed'
  | 'transcription-failed';

export interface VoiceComposerError {
  code: VoiceComposerErrorCode;
  title: string;
  message: string;
}

export function mergeTranscriptIntoDraft(message: string, transcript: string) {
  const trimmedMessage = message.trimEnd();
  if (!trimmedMessage) return transcript;
  return `${trimmedMessage}\n${transcript}`;
}

export function replaceTranscriptInDraft(draft: string, rawText: string, cleanedText: string) {
  const suffix = draft.endsWith(rawText) ? rawText : null;
  if (!suffix) return draft;

  return `${draft.slice(0, -rawText.length)}${cleanedText}`;
}

export function maybeApplyCleanedTranscript(input: {
  currentDraft: string;
  insertedDraft: string;
  rawText: string;
  cleanedText: string;
  changed: boolean;
}) {
  if (!input.changed) return input.currentDraft;
  if (input.currentDraft !== input.insertedDraft) return input.currentDraft;

  return replaceTranscriptInDraft(input.insertedDraft, input.rawText, input.cleanedText);
}

export function isRecorderActive(state: RecorderState) {
  return (
    state === 'REQUESTING_PERMISSION' ||
    state === 'PREPARING' ||
    state === 'RECORDING' ||
    state === 'PAUSED' ||
    state === 'STOPPING'
  );
}

export function deriveVoiceComposerState(input: {
  recorderState: RecorderState;
  isTranscribing: boolean;
  isCleaningVoice: boolean;
  error: VoiceComposerError | null;
}): VoiceComposerState {
  if (input.error) return 'failed';
  if (input.isCleaningVoice) return 'cleaning';
  if (input.isTranscribing) return 'transcribing';
  if (isRecorderActive(input.recorderState)) return 'recording';
  return 'idle';
}

export function createVoiceComposerError(code: VoiceComposerErrorCode): VoiceComposerError {
  switch (code) {
    case 'permission-denied':
      return {
        code,
        title: 'Microphone access required',
        message: 'Allow microphone and speech recognition access to record a voice note.',
      };
    case 'recording-failed':
      return {
        code,
        title: 'Voice recording failed',
        message: 'Omiro could not start recording right now.',
      };
    case 'transcription-failed':
      return {
        code,
        title: 'Voice transcription failed',
        message: 'Your recording was kept, but the transcript could not be generated.',
      };
  }
}
