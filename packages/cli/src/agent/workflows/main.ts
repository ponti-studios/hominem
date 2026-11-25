import { getWorkflowStatus } from './runtime.ts';

export async function main(args: string[]): Promise<number> {
  if (args[0] !== 'status' || !args[1] || args.length !== 2) {
    process.stderr.write('hominem workflow: expected status <run-id>\n');
    return 2;
  }
  try {
    process.stdout.write(`${JSON.stringify(getWorkflowStatus(args[1]), null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(
      `hominem workflow: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}
