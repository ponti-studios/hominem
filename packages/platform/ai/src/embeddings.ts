import {
  DEFAULT_EMBEDDING_MODEL,
  createOpenRouterClient,
  isTestEnvironment,
  type EmbeddingOptions,
} from './shared';

export async function generateEmbedding(content: string, options: EmbeddingOptions = {}) {
  if (isTestEnvironment()) {
    return [] as number[];
  }

  const client = createOpenRouterClient(options);
  const response = await client.embeddings.generate({
    httpReferer: options.httpReferer,
    appTitle: options.appTitle,
    appCategories: options.appCategories,
    requestBody: {
      model: options.model ?? DEFAULT_EMBEDDING_MODEL,
      input: content,
      inputType: options.inputType ?? 'search_document',
      dimensions: options.dimensions,
      encodingFormat: 'float',
    },
  });

  const embeddingResponse =
    typeof response === 'string'
      ? (JSON.parse(response) as { data?: Array<{ embedding?: unknown }> })
      : response;
  const embedding = embeddingResponse.data?.[0]?.embedding;

  return Array.isArray(embedding)
    ? embedding.filter((item): item is number => typeof item === 'number')
    : [];
}
