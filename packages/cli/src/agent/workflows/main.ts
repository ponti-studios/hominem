import { select } from '../select.ts';
import { getWorkflowStatus, listWorkflows } from './runtime.ts';

export async function main(args: string[]): Promise<number> {
  if (args[0] !== 'status' || args.length > 2) {
    process.stderr.write('hominem workflow: expected status [run-id]\n');
    return 2;
  }
  try {
    let id = args[1];
    if (!id) {
      const choices = listWorkflows();
      if (choices.length === 0) {
        process.stderr.write('No workflow runs are available.\n');
        return 2;
      }
      const selected = await select(
        'Select a workflow run:',
        choices.map((choice) => ({
          value: choice.id,
          label: `${choice.name} · ${choice.status} · ${choice.id}`,
        })),
      );
      if (!selected) return 2;
      id = selected;
    }
    process.stdout.write(`${JSON.stringify(getWorkflowStatus(id), null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(
      `hominem workflow: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}
