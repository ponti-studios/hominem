import { Command, Flags } from '@oclif/core';

import { link } from '../../finance-link.js';

export default class FinanceLink extends Command {
  static override summary = 'Pick which of your accounts each bank account belongs to';
  static override examples = [
    '<%= config.bin %> finance link',
    '<%= config.bin %> finance link --dry-run',
  ];
  static override flags = {
    bank: Flags.option({
      description: 'The bank to link',
      options: ['starling'] as const,
      default: 'starling' as const,
    })(),
    'dry-run': Flags.boolean({ description: 'Show the links without saving them' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FinanceLink);
    process.exitCode = await link({ dryRun: flags['dry-run'] });
  }
}
