import { Command } from '@oclif/core';

import { signInWithSetup, terminalAsk } from '../../hominem-setup.js';

export default class Auth extends Command {
  static override summary = 'Sign in to Hominem with OAuth';

  async run(): Promise<void> {
    await this.parse(Auth);
    await signInWithSetup({ ask: terminalAsk() });
  }
}
