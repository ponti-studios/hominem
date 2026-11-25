import { resolve } from 'node:path';

import { select } from '../select.ts';
import { findBatches } from './validate.ts';
import { KnowledgeValidationError, validateExtraction } from './validate.ts';

export async function main(args: string[]): Promise<number> {
  if (args[0] !== 'validate' || args.length > 3) {
    process.stderr.write('hominem knowledge: expected validate [batch-dir] [bodies-dir]\n');
    return 2;
  }
  try {
    let batch = args[1];
    if (!batch) {
      const choices = findBatches(process.cwd());
      if (choices.length === 0) {
        process.stderr.write('No extraction batches found in the current directory.\n');
        return 2;
      }
      batch =
        (await select(
          'Select an extraction batch:',
          choices.map((choice) => ({ value: choice, label: choice })),
        )) ?? '';
      if (!batch) return 2;
    }
    const result = validateExtraction(resolve(batch), args[2] ? resolve(args[2]) : undefined);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof KnowledgeValidationError) {
      process.stdout.write(`${JSON.stringify({ ok: false, issues: error.issues }, null, 2)}\n`);
      return 1;
    }
    process.stderr.write(
      `hominem knowledge: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}
