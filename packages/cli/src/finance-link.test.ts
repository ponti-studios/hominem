import { describe, expect, it } from 'vitest';

import { linkAccounts, type Prompts } from './finance-link.js';

const bankAccounts = [
  { accountUid: 'bank-main', currency: 'GBP', name: 'Personal' },
  { accountUid: 'bank-saver', currency: 'GBP', name: 'Saver' },
];

function account(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    accountType: 'checking',
    currencyCode: 'GBP',
    balance: 0,
    provider: null,
    providerAccountId: null,
    ...extra,
  };
}

function setup(options: {
  accounts?: ReturnType<typeof account>[];
  answers?: Record<string, string>;
  confirmed?: boolean;
  refuse?: string;
  dryRun?: boolean;
}) {
  const accounts = options.accounts ?? [
    account('main'),
    account('saver'),
    account('dollars', { currencyCode: 'USD' }),
  ];
  const offered: Array<Array<string | null>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const lines: string[] = [];
  const prompts: Prompts = {
    pickMany: async (_message, choices) => choices.map((choice) => choice.value),
    pickOne: async (message, choices) => {
      offered.push(choices.map((choice) => choice.value));
      const answer = Object.entries(options.answers ?? {}).find(([name]) => message.includes(name));
      return answer?.[1] ?? null;
    },
    confirm: async () => options.confirmed ?? true,
  };
  const run = () =>
    linkAccounts({
      bankAccounts,
      prompts,
      dryRun: options.dryRun ?? false,
      print: (line) => lines.push(line),
      call: async (tool, args) => {
        if (tool === 'finance_accounts') return { accounts };
        updates.push(args);
        const reason = args.accountId === options.refuse ? 'identity_conflict' : null;
        return { updated: !reason, reason };
      },
    });
  return { run, offered, updates, lines };
}

const answers = { Personal: 'main', Saver: 'saver' };

describe('finance link', () => {
  it('previews every pair before saving any', async () => {
    const test = setup({ answers });
    await expect(test.run()).resolves.toBe(0);
    expect(test.updates.map((update) => [update.accountId, update.dryRun])).toEqual([
      ['main', true],
      ['saver', true],
      ['main', false],
      ['saver', false],
    ]);
    expect(test.updates[2]).toMatchObject({
      provider: 'starling',
      providerAccountId: 'bank-main',
    });
  });

  it('only offers unlinked accounts in the same currency, each once', async () => {
    const test = setup({ answers });
    await test.run();
    expect(test.offered).toEqual([
      ['main', 'saver', null],
      ['saver', null],
    ]);
  });

  it('leaves existing links alone', async () => {
    const test = setup({
      accounts: [
        account('main', { provider: 'starling', providerAccountId: 'bank-main' }),
        account('other', { provider: 'plaid' }),
        account('saver'),
      ],
      answers,
    });
    await test.run();
    expect(test.offered).toEqual([['saver', null]]);
    expect(test.updates.every((update) => update.accountId === 'saver')).toBe(true);
  });

  it.each([{ dryRun: true }, { confirmed: false }])('saves nothing with %j', async (options) => {
    const test = setup({ answers, ...options });
    await expect(test.run()).resolves.toBe(0);
    expect(test.updates.every((update) => update.dryRun === true)).toBe(true);
  });

  it('saves nothing when any pair is refused', async () => {
    const test = setup({ answers, refuse: 'saver' });
    await expect(test.run()).rejects.toThrow('identity_conflict');
    expect(test.updates.every((update) => update.dryRun === true)).toBe(true);
  });

  it('writes nothing when everything is skipped', async () => {
    const test = setup({});
    await expect(test.run()).resolves.toBe(0);
    expect(test.updates).toEqual([]);
    expect(test.lines).toContain('Nothing to link.');
  });
});
