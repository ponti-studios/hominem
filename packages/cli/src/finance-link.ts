import { checkbox, confirm, select } from '@inquirer/prompts';
import { z } from 'zod';

import { applyEnvDefaults } from './env.js';
import { getHominemAccessToken } from './hominem-auth.js';
import { HominemMcp } from './hominem.js';
import { starlingAccounts } from './wealth-providers.js';
import { starlingConfig, WealthError } from './wealth.js';

const accountsSchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      accountType: z.string(),
      currencyCode: z.string(),
      balance: z.number(),
      provider: z.string().nullable(),
      providerAccountId: z.string().nullable(),
    }),
  ),
});

const updateSchema = z.object({ updated: z.boolean(), reason: z.string().nullable() });

type BankAccount = Awaited<ReturnType<typeof starlingAccounts>>[number];
type HominemAccount = z.infer<typeof accountsSchema>['accounts'][number];

interface Choice<Value> {
  name: string;
  value: Value;
  checked?: boolean;
}

export interface Prompts {
  pickMany: (message: string, choices: Choice<string>[]) => Promise<string[]>;
  pickOne: (message: string, choices: Choice<string | null>[]) => Promise<string | null>;
  confirm: (message: string) => Promise<boolean>;
}

const terminalPrompts: Prompts = {
  pickMany: (message, choices) => checkbox({ message, choices }),
  pickOne: (message, choices) => select({ message, choices }),
  confirm: (message) => confirm({ message, default: false }),
};

interface LinkDeps {
  bankAccounts: BankAccount[];
  call: (tool: string, args: Record<string, unknown>) => Promise<unknown>;
  prompts: Prompts;
  dryRun: boolean;
  print: (line: string) => void;
}

function bankLabel(account: BankAccount): string {
  const kind = account.accountType ? `, ${account.accountType}` : '';
  return `${account.name ?? 'Unnamed'} (${account.currency}${kind}, ${account.accountUid.slice(0, 8)})`;
}

function hominemLabel(account: HominemAccount): string {
  return `${account.name} (${account.accountType}, ${account.currencyCode} ${account.balance.toFixed(2)})`;
}

/**
 * Pairs bank accounts with accounts you already have. It only stamps the bank's id on an account
 * that has no provider yet, so it never creates an account or replaces an existing link.
 */
export async function linkAccounts(deps: LinkDeps): Promise<number> {
  const { bankAccounts, call, prompts, dryRun, print } = deps;
  const { accounts } = accountsSchema.parse(await call('finance_accounts', {}));

  const unlinked: BankAccount[] = [];
  for (const bank of bankAccounts) {
    const linked = accounts.find(
      (account) => account.provider === 'starling' && account.providerAccountId === bank.accountUid,
    );
    if (linked) print(`Already linked: ${bankLabel(bank)} -> ${linked.name}`);
    else unlinked.push(bank);
  }
  if (!unlinked.length) {
    print('Every Starling account is linked.');
    return 0;
  }

  const picked = await prompts.pickMany(
    'Which Starling accounts do you want to link?',
    unlinked.map((bank) => ({ name: bankLabel(bank), value: bank.accountUid, checked: true })),
  );

  const links: Array<{ bank: BankAccount; account: HominemAccount }> = [];
  for (const bank of unlinked.filter((candidate) => picked.includes(candidate.accountUid))) {
    const open = accounts.filter(
      (account) =>
        account.provider === null &&
        account.currencyCode === bank.currency &&
        !links.some((link) => link.account.id === account.id),
    );
    if (!open.length) {
      print(`No unlinked ${bank.currency} account left for ${bankLabel(bank)}.`);
      continue;
    }
    const id = await prompts.pickOne(`Which Hominem account is ${bankLabel(bank)}?`, [
      ...open.map((account) => ({ name: hominemLabel(account), value: account.id })),
      { name: 'Skip this one', value: null },
    ]);
    const account = open.find((candidate) => candidate.id === id);
    if (account) links.push({ bank, account });
  }
  if (!links.length) {
    print('Nothing to link.');
    return 0;
  }

  const update = async (link: (typeof links)[number], preview: boolean) => {
    const result = updateSchema.parse(
      await call('finance_account_update', {
        accountId: link.account.id,
        provider: 'starling',
        providerAccountId: link.bank.accountUid,
        dryRun: preview,
      }),
    );
    if (result.reason) {
      throw new WealthError(`Could not link ${link.account.name}: ${result.reason}`);
    }
  };

  // Check every pair before writing any, so one refusal doesn't leave you half linked.
  for (const link of links) await update(link, true);
  for (const link of links) print(`${bankLabel(link.bank)} -> ${hominemLabel(link.account)}`);
  if (dryRun) {
    print('Dry run: nothing changed.');
    return 0;
  }
  if (!(await prompts.confirm(`Save ${links.length === 1 ? 'this link' : 'these links'}?`))) {
    print('Nothing changed.');
    return 0;
  }
  for (const link of links) {
    await update(link, false);
    print(`Linked ${link.account.name}.`);
  }
  print('Next: hominem finance sync --bank starling --dry-run');
  return 0;
}

export async function link({ dryRun }: { dryRun: boolean }): Promise<number> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new WealthError('`finance link` asks questions, so run it in a terminal.');
  }
  applyEnvDefaults();
  const token = await getHominemAccessToken();
  const bankAccounts = await starlingAccounts(starlingConfig());
  const hominem = new HominemMcp({ token: token.access_token, url: `${token.api_url}/api/mcp` });
  try {
    return await linkAccounts({
      bankAccounts,
      call: (tool, args) => hominem.call(tool, args),
      prompts: terminalPrompts,
      dryRun,
      print: (line) => console.log(line),
    });
  } catch (error) {
    // Ctrl+C at a prompt.
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log('Cancelled.');
      return 130;
    }
    throw error;
  }
}
