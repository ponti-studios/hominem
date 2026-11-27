import { Command } from '@oclif/core';

import { chatMain } from '../agent/chat.ts';
import { applyEnvDefaults } from '../env.js';

export default class Reflect extends Command {
  static override summary = 'Extract and save durable conversation facts from stdin';
  static override usage = 'reflect < transcript';
  // The request is free text, so take however many words come in.
  static override strict = false;

  async run(): Promise<void> {
    const { argv } = await this.parse(Reflect);
    applyEnvDefaults();
    process.exitCode = await chatMain('reflect', argv.map(String));
  }
}
