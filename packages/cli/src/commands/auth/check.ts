import { Command, Flags } from '@oclif/core';

import { checkAuth } from '../../auth.js';

export default class AuthCheck extends Command {
  static override summary = 'Live Google token check';
  static override description = 'Exit 0 healthy, 1 dead, 2 couldn’t check.';
  static override flags = {
    notify: Flags.boolean({ description: 'Post a macOS notification if the token is dead' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AuthCheck);
    process.exitCode = await checkAuth({ notify: flags.notify });
  }
}
