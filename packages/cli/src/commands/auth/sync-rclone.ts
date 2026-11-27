import { Command } from '@oclif/core';

import { syncRclone } from '../../system.js';

export default class AuthSyncRclone extends Command {
  static override summary = 'Copy the current Google token into the rclone remote';

  async run(): Promise<void> {
    await this.parse(AuthSyncRclone);
    this.log(await syncRclone());
  }
}
