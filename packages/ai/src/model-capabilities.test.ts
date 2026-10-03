import { describe, expect, it } from 'vitest';

import { getModelCapabilityProfile } from './model-capabilities';

describe('model capability profiles', () => {
  it('isolates Muse compatibility from chat routing', () => {
    expect(getModelCapabilityProfile('meta/muse-spark-1.3').structuredPlanning).toBe(false);
    expect(getModelCapabilityProfile('openai/gpt-4o-mini').structuredPlanning).toBe(true);
  });

  it('uses the supported minimal reasoning effort for GPT-5 mini', () => {
    expect(getModelCapabilityProfile('openai/gpt-5-mini')).toEqual({
      structuredPlanning: true,
      reasoning: { effort: 'minimal' },
    });
  });

  it('uses low reasoning effort for GLM 5.3 Flash, which cannot disable reasoning', () => {
    expect(getModelCapabilityProfile('z-ai/glm-5.3-flash')).toEqual({
      structuredPlanning: true,
      reasoning: { effort: 'low' },
    });
  });
});
