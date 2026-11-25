import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { finishRun, logRun } from '../log/agent_log.ts';
import script from './nameplate.py' with { type: 'text' };

const argsSchema = z.object({
  word: z.string().min(1),
  font: z.string().min(1),
  texture: z.string().min(1),
  preset: z.enum(['platinum', 'gold']),
  output: z.string().min(1),
  preview: z.string().optional(),
  width: z.coerce.number().int().positive().default(3750),
  padding: z.coerce.number().int().nonnegative().default(140),
  tile: z.coerce.number().int().positive().default(880),
  sparkles: z.coerce.number().int().nonnegative().default(13),
  seed: z.coerce.number().int().default(23),
});

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return args[index + 1];
}

function parseArgs(args: string[]) {
  const known = new Set([
    '--word',
    '--font',
    '--texture',
    '--preset',
    '--output',
    '--preview',
    '--width',
    '--padding',
    '--tile',
    '--sparkles',
    '--seed',
  ]);
  for (let index = 0; index < args.length; index += 2) {
    if (!known.has(args[index] ?? '') || index + 1 >= args.length) {
      throw new Error(`hominem studio nameplate: invalid arguments at ${args[index] ?? 'end'}`);
    }
  }
  return argsSchema.safeParse({
    word: value(args, 'word'),
    font: value(args, 'font'),
    texture: value(args, 'texture'),
    preset: value(args, 'preset'),
    output: value(args, 'output'),
    preview: value(args, 'preview'),
    width: value(args, 'width') ?? 3750,
    padding: value(args, 'padding') ?? 140,
    tile: value(args, 'tile') ?? 880,
    sparkles: value(args, 'sparkles') ?? 13,
    seed: value(args, 'seed') ?? 23,
  });
}

async function render(input: z.infer<typeof argsSchema>): Promise<string> {
  const python = process.env.HOMINEM_PYTHON ?? 'python3';
  const args = [
    '-c',
    script,
    '--word',
    input.word,
    '--font',
    input.font,
    '--texture',
    input.texture,
    '--preset',
    input.preset,
    '--output',
    input.output,
    '--width',
    String(input.width),
    '--padding',
    String(input.padding),
    '--tile',
    String(input.tile),
    '--sparkles',
    String(input.sparkles),
    '--seed',
    String(input.seed),
  ];
  if (input.preview) args.push('--preview', input.preview);

  return await new Promise((done, reject) => {
    const child = spawn(python, args, { env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.once('error', (error) =>
      reject(
        new Error(
          `nameplate renderer could not start with HOMINEM_PYTHON=${python}: ${error.message}`,
        ),
      ),
    );
    child.once('close', (status) => {
      if (status === 0) {
        done(stdout);
        return;
      }
      reject(
        new Error(
          `nameplate renderer exited ${status}: ${stderr.trim() || stdout.trim() || 'no output'}`,
        ),
      );
    });
  });
}

export async function main(args: string[]): Promise<number> {
  if (args[0] !== 'nameplate') {
    process.stderr.write('hominem studio: expected nameplate\n');
    return 2;
  }
  const parsed = parseArgs(args.slice(1));
  if (!parsed.success) {
    process.stderr.write(
      `hominem studio nameplate: ${parsed.error.issues[0]?.message ?? 'invalid arguments'}\n`,
    );
    return 2;
  }
  const input = parsed.data;
  input.font = resolve(input.font);
  input.texture = resolve(input.texture);
  input.output = resolve(input.output);
  if (input.preview) input.preview = resolve(input.preview);
  for (const [name, path] of [
    ['font', input.font],
    ['texture', input.texture],
  ]) {
    if (!existsSync(path)) {
      process.stderr.write(`hominem studio nameplate: ${name} not found: ${path}\n`);
      return 2;
    }
  }

  const runId = logRun('studio-nameplate', {
    status: 'invoked',
    context: {
      preset: input.preset,
      word: input.word,
      width: input.width,
      output: input.output,
      preview: input.preview ?? null,
    },
  });
  try {
    const receipt = await render(input);
    finishRun(runId, {
      status: 'completed',
      exitCode: 0,
      message: `${input.preset} ${input.output}`,
    });
    process.stdout.write(receipt);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finishRun(runId, {
      status: 'failed',
      exitCode: 1,
      message: message.slice(0, 500),
    });
    process.stderr.write(`hominem studio nameplate: ${message}\n`);
    return 1;
  }
}
