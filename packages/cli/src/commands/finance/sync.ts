import { Command, Flags } from '@oclif/core';

import { syncFlags } from '../../sync-flags.js';
import { sync } from '../../wealth.js';

export default class FinanceSync extends Command {
  static override summary = 'Add new bank transactions; stored ones are never rewritten';
  static override examples = [
    '<%= config.bin %> finance sync --bank starling --dry-run',
    '<%= config.bin %> finance sync --bank starling --from 2026-11-01',
  ];
  static override flags = {
    bank: Flags.option({
      description: 'Only sync this bank',
      options: ['starling'] as const,
    })(),
    ...syncFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FinanceSync);
    const { bank, from, until } = flags;
    process.exitCode = await sync({ bank, from, until, dryRun: flags['dry-run'] });
  }
}
