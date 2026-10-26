import { describe, expect, it } from 'vitest';

import { resolveAiProvider, resolveEmailProvider } from './provider-mode';

describe('provider mode', () => {
  it('picks the AI provider from the USE_SCRIPTED_AI const, not the environment', () => {
    expect(['scripted', 'openrouter']).toContain(resolveAiProvider());
  });

  it('selects the scripted email provider with ENV=scripted', () => {
    expect(
      resolveEmailProvider({
        ENV: 'scripted',
        NODE_ENV: 'production',
      }),
    ).toBe('scripted');
  });

  it('keeps the existing defaults outside scripted mode', () => {
    expect(
      resolveEmailProvider({
        ENV: undefined,
        NODE_ENV: 'production',
      }),
    ).toBe('resend');
    expect(
      resolveEmailProvider({
        ENV: undefined,
        NODE_ENV: 'development',
      }),
    ).toBe('scripted');
  });
});
