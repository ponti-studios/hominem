import { Command } from '@oclif/core';

import { chatMain } from '../agent/chat.ts';
import { applyEnvDefaults } from '../env.js';

export default class Chat extends Command {
  static override summary = 'Run the personal agent';
  static override usage = 'chat "request"';
  // The request is free text, so take however many words come in.
  static override strict = false;

  async run(): Promise<void> {
    const { argv } = await this.parse(Chat);
    applyEnvDefaults();
    process.exitCode = await chatMain('chat', argv.map(String));
  }
}
