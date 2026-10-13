export type OpenRouterUsageReport = {
  cost?: number | null;
  total_tokens?: number | null;
};

export type OpenRouterChatResponse = {
  id?: string | null;
  model?: string | null;
  usage?: OpenRouterUsageReport | null;
};

/**
 * Ori prices a custom-harness run from `usage.costUsd` on its terminal event.
 * Multi-turn runs therefore report accumulated, not per-turn, usage; an unknown
 * cost remains absent rather than being reported as zero.
 */
export type PricedUsage = {
  contextTokens?: number;
  costUsd?: number;
  generationId?: string | null;
};

function addOptional(first: number | undefined, second: number | undefined): number | undefined {
  if (typeof first !== 'number') return second;
  if (typeof second !== 'number') return first;
  return first + second;
}

export function pricedUsageFromOpenRouter(response: OpenRouterChatResponse): PricedUsage {
  return {
    contextTokens: response.usage?.total_tokens ?? undefined,
    costUsd: response.usage?.cost ?? undefined,
    generationId: response.id ?? undefined,
  };
}

export function addPricedUsage(current: PricedUsage, next: PricedUsage): PricedUsage {
  const generationId = next.generationId ?? current.generationId;
  return {
    contextTokens: addOptional(current.contextTokens, next.contextTokens),
    costUsd: addOptional(current.costUsd, next.costUsd),
    ...(generationId === undefined ? {} : { generationId }),
  };
}
