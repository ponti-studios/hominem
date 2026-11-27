import { Command } from '@oclif/core';

import { seed } from '../../wealth.js';

export default class WealthSeed extends Command {
  static override summary = 'Seed Starling accounts and optional doctrine';

  async run(): Promise<void> {
    await this.parse(WealthSeed);
    process.exitCode = await seed();
  }
}
