import { Command } from '@oclif/core';

import { integrity } from '../../wealth.js';

export default class WealthIntegrity extends Command {
  static override summary = 'Ledger integrity against live Plaid and Starling feeds';

  async run(): Promise<void> {
    await this.parse(WealthIntegrity);
    process.exitCode = await integrity();
  }
}
