import type { ReasoningConfig } from './shared';

export type ModelCapabilityProfile = {
  structuredPlanning: boolean;
  reasoning: ReasoningConfig;
};

export function getModelCapabilityProfile(model: string): ModelCapabilityProfile {
  // GPT-5 mini does not support disabling reasoning; minimal keeps requests
  // fast while satisfying its reasoning-effort contract.
  if (model === 'openai/gpt-5-mini') {
    return { structuredPlanning: true, reasoning: { effort: 'minimal' } };
  }
  // GLM 5.3 Flash rejects `effort: none` and `enabled: false` with a 400
  // ("Reasoning is mandatory"); low is the cheapest effort it accepts.
  if (model === 'z-ai/glm-5.3-flash') {
    return { structuredPlanning: true, reasoning: { effort: 'low' } };
  }
  // Muse Spark currently rejects the provider's structured-output/reasoning
  // controls. Keep that compatibility decision in one profile instead of
  // spreading provider-name checks through chat routing.
  if (model.startsWith('meta/muse-spark-1.3')) {
    return { structuredPlanning: false, reasoning: undefined };
  }
  return { structuredPlanning: true, reasoning: { effort: 'none' } };
}
