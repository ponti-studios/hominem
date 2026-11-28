import { Command } from '@oclif/core';

import { installAgent } from '../../launchd.js';

export default class AgentInstall extends Command {
  static override summary = 'Install the daily 9:00 auth check (launchd)';

  async run(): Promise<void> {
    await this.parse(AgentInstall);
    this.log(await installAgent());
  }
}
