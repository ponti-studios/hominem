import { describe, expect, it } from 'vitest';

import { resolveAiProvider, resolveEmailProvider } from './provider-mode';

describe('provider mode', () => {
  it('picks the AI provider from USE_SCRIPTED_AI', () => {
    expect(resolveAiProvider({ USE_SCRIPTED_AI: true })).toBe('scripted');
    expect(resolveAiProvider({ USE_SCRIPTED_AI: false })).toBe('openrouter');
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
