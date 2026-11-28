import { Command } from '@oclif/core';

import { googleAuth } from '../../auth.js';

export default class AuthGoogle extends Command {
  static override summary = 'Sign in to Google (opens browser) and sync rclone';

  async run(): Promise<void> {
    await this.parse(AuthGoogle);
    await googleAuth();
  }
}
