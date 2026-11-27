import { Command } from '@oclif/core';

import { uninstallAgent } from '../../launchd.js';

export default class AgentUninstall extends Command {
  static override summary = 'Remove the daily auth check';

  async run(): Promise<void> {
    await this.parse(AgentUninstall);
    this.log(await uninstallAgent());
  }
}
