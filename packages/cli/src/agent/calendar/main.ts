import { main as analyze } from './analyze.ts';

export async function main(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'hominem calendar\n\n' +
        'Read-only Google Calendar analysis.\n\n' +
        'Actions:\n' +
        '  analyze  Pull or reuse primary-calendar events and write a report\n\n' +
        'Usage:\n' +
        '  hominem calendar\n' +
        '  hominem calendar analyze [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--no-pull] [--json]\n',
    );
    return 0;
  }
  return analyze(args);
}
