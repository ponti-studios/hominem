import { Command } from '@oclif/core';

import { chatMain } from '../agent/chat.ts';
import { applyEnvDefaults } from '../env.js';

export default class Remember extends Command {
  static override summary = 'Save a durable memory';
  static override usage = 'remember "fact"';
  // The request is free text, so take however many words come in.
  static override strict = false;

  async run(): Promise<void> {
    const { argv } = await this.parse(Remember);
    applyEnvDefaults();
    process.exitCode = await chatMain('remember', argv.map(String));
  }
}
