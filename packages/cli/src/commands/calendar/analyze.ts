import { Command, Flags } from '@oclif/core';

import { main as analyzeCalendar } from '../../agent/calendar/analyze.ts';

export default class CalendarAnalyze extends Command {
  static override id = 'calendar analyze';
  static override summary = 'Analyze the primary Google Calendar';
  static override description =
    'Read primary-calendar events, find exceptions, and write JSON/Markdown reports.';
  static override usage =
    'hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]';
  static override examples = [
    '<%= config.bin %> calendar analyze',
    '<%= config.bin %> calendar analyze --start 2026-11-26 --end 2026-11-26',
    '<%= config.bin %> calendar analyze --no-pull --json',
  ];
  static override flags = {
    help: Flags.help({ char: 'h' }),
    start: Flags.string({ description: 'First local calendar date' }),
    end: Flags.string({ description: 'Last local calendar date' }),
    'no-pull': Flags.boolean({
      description: 'Reuse the existing machine-local event cache',
      default: false,
    }),
    json: Flags.boolean({
      description: 'Emit the machine-readable JSON envelope',
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CalendarAnalyze);
    const argv = ['analyze'];
    if (flags.start) argv.push('--start', flags.start);
    if (flags.end) argv.push('--end', flags.end);
    if (flags['no-pull']) argv.push('--no-pull');
    if (flags.json) argv.push('--json');
    process.exitCode = await analyzeCalendar(argv);
  }
}
