import { Command } from '@oclif/core';

import { syncFlags } from '../../sync-flags.js';
import { sync } from '../../wealth.js';

export default class WealthSync extends Command {
  static override summary = 'Send provider transactions to Hominem for routing and import';
  static override flags = syncFlags;

  async run(): Promise<void> {
    const { flags } = await this.parse(WealthSync);
    const { from, until } = flags;
    process.exitCode = await sync({ from, until, dryRun: flags['dry-run'] });
  }
}
