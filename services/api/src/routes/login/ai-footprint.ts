// Directional infrastructure assumptions used by the AI usage summary
// and the footprint explainer. These are estimates, not provider telemetry.
export const AI_FOOTPRINT_ESTIMATES = {
  electricityKwhPerRequest: 0.00034,
  waterLitersPerRequest: 0.01,
} as const;

export function estimateAIFootprint(requestCount: number) {
  return {
    electricityKwh: requestCount * AI_FOOTPRINT_ESTIMATES.electricityKwhPerRequest,
    waterLiters: requestCount * AI_FOOTPRINT_ESTIMATES.waterLitersPerRequest,
  };
}
