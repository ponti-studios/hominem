import { describe, expect, it, vi } from 'vitest';

import { inviteToThames, type InviteDeps } from './thames-invite';

function deps(overrides: Partial<InviteDeps> = {}) {
  const send = vi.fn(async (_message: Parameters<InviteDeps['send']>[0]) => {});
  const counts = new Map<string, number>();
  const base: InviteDeps = {
    link: 'https://testflight.apple.com/join/abc',
    isAllowed: async (email) => email.endsWith('@work.com'),
    withinLimit: async (key, max) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next <= max;
    },
    qrPng: async () => Buffer.from('png'),
    send,
    ...overrides,
  };
  return { base, send };
}

const who = { email: ' Dana@Work.com ', network: '1.2.3.4' };

describe('inviteToThames', () => {
  it('emails the QR code and link to an allowed address', async () => {
    const { base, send } = deps();
    expect(await inviteToThames(base, who)).toBe('sent');
    const message = send.mock.calls[0]![0];
    expect(message.to).toBe('dana@work.com');
    expect(message.html).toContain('https://testflight.apple.com/join/abc');
    expect(message.attachments[0]!.contentId).toBe('thames-invite');
  });

  it('sends nothing to an address that is not allowed', async () => {
    const { base, send } = deps();
    expect(await inviteToThames(base, { email: 'x@elsewhere.com', network: 'n' })).toBe(
      'not_listed',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('stops after three tries for one address', async () => {
    const { base, send } = deps();
    for (let i = 0; i < 3; i += 1) await inviteToThames(base, who);
    expect(await inviteToThames(base, who)).toBe('rate_limited');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('stops one network sending to many addresses', async () => {
    const { base } = deps();
    for (let i = 0; i < 20; i += 1) {
      await inviteToThames(base, { email: `p${i}@work.com`, network: 'same' });
    }
    expect(await inviteToThames(base, { email: 'p99@work.com', network: 'same' })).toBe(
      'rate_limited',
    );
  });

  it('does nothing without a configured link', async () => {
    const { base, send } = deps({ link: undefined });
    expect(await inviteToThames(base, who)).toBe('unavailable');
    expect(send).not.toHaveBeenCalled();
  });
});
