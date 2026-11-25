import { createInterface } from 'node:readline/promises';

export interface SelectOption {
  value: string;
  label: string;
}

export async function select(prompt: string, options: SelectOption[]): Promise<string | null> {
  if (options.length === 0) return null;
  if (options.length === 1) return options[0]!.value;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      `${prompt}\n${options.map((option, index) => `  ${index + 1}. ${option.label}`).join('\n')}\n`,
    );
    return null;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(
      `${prompt}\n${options.map((option, index) => `  ${index + 1}. ${option.label}`).join('\n')}\n`,
    );
    const answer = await rl.question('Select: ');
    const option = options[Number(answer) - 1];
    if (!option) {
      process.stderr.write('Selection is out of range.\n');
      return null;
    }
    return option.value;
  } finally {
    rl.close();
  }
}
