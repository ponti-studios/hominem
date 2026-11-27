import { Command } from '@oclif/core';

import { close } from '../../wealth.js';

export default class WealthClose extends Command {
  static override summary = 'Monthly close markdown (WEALTH_CLOSE_MONTH, WEALTH_CLOSE_OUT)';

  async run(): Promise<void> {
    await this.parse(WealthClose);
    process.exitCode = await close();
  }
}
