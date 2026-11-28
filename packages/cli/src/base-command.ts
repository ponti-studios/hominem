import { Command } from '@oclif/core';

import { applyEnvDefaults } from './env.js';

/**
 * A command whose own module reads the raw arguments, help included. The runner hands these
 * straight to the command so oclif's `--help` doesn't swallow the connector's own.
 */
export abstract class PassthroughCommand extends Command {
  static override strict = false;

  protected abstract main(args: string[]): number | Promise<number>;

  async run(): Promise<void> {
    // Nothing for oclif to parse, so tell it not to warn about that.
    this.parsed = true;
    applyEnvDefaults();
    process.exitCode = await this.main(this.argv);
  }
}
