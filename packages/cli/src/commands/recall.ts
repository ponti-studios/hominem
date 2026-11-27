import { Command } from '@oclif/core';

import { chatMain } from '../agent/chat.ts';
import { applyEnvDefaults } from '../env.js';

export default class Recall extends Command {
  static override summary = 'Search durable memory';
  static override usage = 'recall "query"';
  // The request is free text, so take however many words come in.
  static override strict = false;

  async run(): Promise<void> {
    const { argv } = await this.parse(Recall);
    applyEnvDefaults();
    process.exitCode = await chatMain('recall', argv.map(String));
  }
}
