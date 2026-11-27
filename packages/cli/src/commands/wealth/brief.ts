import { Command } from '@oclif/core';

import { brief } from '../../wealth.js';

export default class WealthBrief extends Command {
  static override summary = 'Morning brief (bill snapshot kept locally)';

  async run(): Promise<void> {
    await this.parse(WealthBrief);
    process.exitCode = await brief();
  }
}
