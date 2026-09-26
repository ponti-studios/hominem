import { describe, expect, it } from 'vitest';

import { getModelCapabilityProfile } from './model-capabilities';

describe('model capability profiles', () => {
  it('isolates Muse compatibility from chat routing', () => {
    expect(getModelCapabilityProfile('meta/muse-spark-1.3').structuredPlanning).toBe(false);
    expect(getModelCapabilityProfile('openai/gpt-4o-mini').structuredPlanning).toBe(true);
  });
});
