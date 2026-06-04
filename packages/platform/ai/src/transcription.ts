import {
  DEFAULT_TRANSCRIPTION_MODEL,
  createOpenRouterClient,
  isTestEnvironment,
  type TranscriptionOptions,
} from './shared';

export function toAudioFormat(mimeType: string) {
  if (mimeType.includes('webm')) {
    return 'webm';
  }

  if (mimeType.includes('mp4')) {
    return 'mp4';
  }

  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
    return 'mp3';
  }

  if (mimeType.includes('wav')) {
    return 'wav';
  }

  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  if (mimeType.includes('aac')) {
    return 'aac';
  }

  if (mimeType.includes('flac')) {
    return 'flac';
  }

  return mimeType;
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string,
  options: TranscriptionOptions = {},
) {
  if (isTestEnvironment()) {
    return 'Test assistant reply';
  }

  const client = createOpenRouterClient(options);
  const response = await client.stt.createTranscription({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    sttRequest: {
      model: options.model ?? DEFAULT_TRANSCRIPTION_MODEL,
      inputAudio: {
        data: audioBase64,
        format: toAudioFormat(mimeType),
      },
      language: options.language,
    },
  });

  return response.text;
}
