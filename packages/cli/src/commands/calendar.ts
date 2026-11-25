import { Command, Flags } from '@oclif/core';

export default class Calendar extends Command {
  static override id = 'calendar';
  static override summary = 'Google Calendar analysis';
  static override description =
    'Read-only primary-calendar analysis with optional live or cached reports.';
  static override usage = 'hominem calendar';
  static override examples = [
    '<%= config.bin %> calendar analyze --start 2026-11-26 --end 2026-11-26',
  ];

  static override flags = {
    help: Flags.help({ char: 'h' }),
  };

  async run(): Promise<void> {
    this.log(
      [
        'Hominem Calendar',
        '',
        'Actions:',
        '  analyze  Pull or reuse primary-calendar events and write a report',
        '',
        'Usage:',
        '  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]',
        '',
        'Run `hominem calendar analyze --help` for analysis options.',
      ].join('\n'),
    );
  }
}
