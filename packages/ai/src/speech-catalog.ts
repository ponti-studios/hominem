/**
 * The speech models a reply can be read with, shared by every surface that speaks replies.
 * Pure data and lookups: the apps keep their own storage and playback.
 */

export type SpeechModel = {
  id: string;
  name: string;
  /** Used until a voice has been picked for this model. */
  defaultVoice: string;
  price: string;
};

/** The first is the default. */
export const SPEECH_MODELS: readonly SpeechModel[] = [
  {
    id: 'hexgrad/kokoro-82m',
    name: 'Kokoro 82M',
    defaultVoice: 'af_heart',
    price: '$0.62 per million characters',
  },
  {
    id: 'google/gemini-3.8-flash-lite-tts',
    name: 'Gemini 3.8 Flash Lite TTS',
    defaultVoice: 'Kore',
    price: 'about $14 per million characters',
  },
];

export const DEFAULT_SPEECH_MODEL: SpeechModel = SPEECH_MODELS[0];
export const DEFAULT_VOICE = DEFAULT_SPEECH_MODEL.defaultVoice;

/** The model for an id, or the default when the id is unknown. */
export const speechModelFor = (id: string): SpeechModel =>
  SPEECH_MODELS.find((model) => model.id === id) ?? DEFAULT_SPEECH_MODEL;

/** The voice to use for a model: the one the user picked, or that model's default. */
export function speechVoiceFor(modelId: string, picked: Record<string, string>): string {
  return picked[modelId] || speechModelFor(modelId).defaultVoice;
}
