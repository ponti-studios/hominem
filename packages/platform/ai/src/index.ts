export { chat } from '@tanstack/ai';
export { openRouterText } from '@tanstack/ai-openrouter';
export { webFetchTool, webSearchTool } from '@tanstack/ai-openrouter/tools';

export {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  createOpenRouterClient,
  hasOpenRouterApiKey,
} from './shared';

export type {
  EmbeddingOptions,
  ImageGenerationOptions,
  OpenRouterClientOptions,
  SharedChatCompletionBody,
  SharedChatCompletionResponse,
  SharedChatCompletionStreamChunk,
  SharedChatMessage,
  TranscriptionOptions,
} from './shared';

export {
  createChatCompletion,
  createOpenRouterTextAdapter,
  enhanceText,
  getChatCompletionText,
  getSharedAiModelConfig,
  getSharedTextModel,
  postChatCompletion,
  streamChatCompletion,
} from './chat';

export type { OpenRouterTextAdapterOptions } from './chat';

export { generateEmbedding } from './embeddings';
export { generateImageFromPrompt } from './image';
export { toAudioFormat, transcribeAudio } from './transcription';
