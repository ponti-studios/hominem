import { main as nameplate } from './nameplate.ts';

export async function main(args: string[]): Promise<number> {
  if (args[0] === 'nameplate') return nameplate(args);
  process.stderr.write('hominem studio: expected nameplate\n');
  return 2;
}
