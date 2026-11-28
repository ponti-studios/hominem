import { Command } from '@oclif/core';

import { balances } from '../../wealth.js';

export default class WealthBalances extends Command {
  static override summary = 'Show live Starling balances';

  async run(): Promise<void> {
    await this.parse(WealthBalances);
    process.exitCode = await balances();
  }
}
