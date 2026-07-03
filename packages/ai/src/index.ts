export { chat } from '@tanstack/ai';
export { openRouterText } from '@tanstack/ai-openrouter';
export { webFetchTool, webSearchTool } from '@tanstack/ai-openrouter/tools';

export {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_SPEECH_MODEL,
  DEFAULT_TASK_EXTRACTION_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_TRANSCRIPTION_MODEL,
  DEFAULT_VOICE_CLEANUP_MODEL,
  createOpenRouterClient,
  isJsonObject,
  OpenRouterRequestError,
} from './shared';

export type {
  EmbeddingOptions,
  ImageGenerationOptions,
  JsonObject,
  OpenRouterClientLike,
  OpenRouterClientOptions,
  TranscriptionOptions,
} from './shared';

export type { ChatMessage as SharedChatMessage } from './text';

export {
  createChatCompletion,
  createOpenRouterTextAdapter,
  enhanceText,
  getChatCompletionText,
  getSharedAiModelConfig,
  getSharedTextModel,
  postChatCompletion,
  streamChatCompletion,
} from './text';

export type { OpenRouterTextAdapterOptions } from './text';

export { generateEmbedding } from './embeddings';
export { generateImageFromPrompt } from './image';
export { cleanupVoiceTranscript } from './voice-cleanup';

export type { VoiceTranscriptCleanupInput, VoiceTranscriptCleanupOutput } from './voice-cleanup';

export { extractTasks } from './task-extraction';

export type { ExtractedTask, TaskExtractionInput, TaskExtractionOutput } from './task-extraction';
