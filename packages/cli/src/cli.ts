import { Config, Errors, Plugin, run } from '@oclif/core';

import packageJson from '../package.json' with { type: 'json' };
import { PassthroughCommand } from './base-command.js';
import { COMMANDS } from './commands/index.js';
import { describeError } from './errors.js';

async function loadConfig(): Promise<Config> {
  const root = import.meta.dirname;
  const plugin = new Plugin({
    root,
    isRoot: true,
    ignoreManifest: true,
    pjson: {
      ...packageJson,
      oclif: {
        ...packageJson.oclif,
        // TypeScript reads JSON strings as plain `string`, so spell out the literals here.
        topicSeparator: ' ',
        commands: { ...packageJson.oclif.commands, strategy: 'explicit' },
      },
    },
  });
  // oclif would import the commands file from disk, which a compiled binary doesn't have.
  // Seeding its cache hands it the bundled classes instead.
  plugin['commandCache'] = COMMANDS;
  await plugin.load();
  return Config.load({
    root,
    plugins: new Map([[plugin.name, plugin]]),
    devPlugins: false,
    userPlugins: false,
  });
}

function isPassthrough(id: string): boolean {
  return Object.entries(COMMANDS).some(
    ([name, command]) => name === id && command.prototype instanceof PassthroughCommand,
  );
}

function report(error: unknown, command: string | undefined): void {
  if (error instanceof Errors.ExitError) {
    process.exitCode = error.oclif.exit;
    return;
  }
  if (process.env.HOMINEM_DEBUG) console.error(error);
  // oclif's own errors (bad flag, unknown command) already say what's wrong.
  const usage = error instanceof Errors.CLIError ? error : undefined;
  const message = usage ? usage.message : describeError(error);
  if (command === 'wealth' || command === 'finance') {
    console.log(JSON.stringify({ ok: false, error: message }));
  } else {
    // Server and user text can end up in a message, so keep it to one line.
    console.error(message.replace(/\p{Cc}+/gu, ' '));
  }
  process.exitCode = usage?.oclif.exit ?? 1;
}

export async function runCli(argv: string[]): Promise<void> {
  const [first = '', ...rest] = argv;
  try {
    const config = await loadConfig();
    if (isPassthrough(first)) await config.runCommand(first, rest);
    else await run(first === 'help' ? [...rest, '--help'] : argv, config);
  } catch (error) {
    report(error, first);
  }
}
