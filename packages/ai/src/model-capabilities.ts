import type { ReasoningConfig } from './shared';

export type ModelCapabilityProfile = {
  structuredPlanning: boolean;
  reasoning: ReasoningConfig;
};

export function getModelCapabilityProfile(model: string): ModelCapabilityProfile {
  // Muse Spark currently rejects the provider's structured-output/reasoning
  // controls. Keep that compatibility decision in one profile instead of
  // spreading provider-name checks through chat routing.
  if (model.startsWith('meta/muse-spark-1.3')) {
    return { structuredPlanning: false, reasoning: undefined };
  }
  return { structuredPlanning: true, reasoning: { effort: 'none' } };
}
