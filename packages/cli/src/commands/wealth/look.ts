import { Command } from '@oclif/core';

import { look } from '../../wealth.js';

export default class WealthLook extends Command {
  static override summary = 'Forward look with a live USD-to-GBP rate';

  async run(): Promise<void> {
    await this.parse(WealthLook);
    process.exitCode = await look();
  }
}
