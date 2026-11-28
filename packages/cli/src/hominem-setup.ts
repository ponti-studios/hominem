import { createInterface } from 'node:readline/promises';

import { applyEnvDefaults, envFilePath, saveEnvValue } from './env.js';
import { isNetworkError } from './errors.js';
import {
  DEFAULT_API_URL,
  HominemAuthError,
  discoverHominem,
  hominemApiUrl,
  hominemAuth,
} from './hominem-auth.js';

const KEY = 'HOMINEM_API_URL';

type AuthOptions = NonNullable<Parameters<typeof hominemAuth>[0]>;

export type SetupOptions = AuthOptions & {
  envFile?: string;
  /** Asks one question. Leave it out when nobody is there to answer. */
  ask?: (question: string) => Promise<string>;
};

async function askInTerminal(question: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  // Ctrl+C closes the interface; turn that into a clean cancel instead of a hung promise.
  const cancel = new AbortController();
  terminal.on('SIGINT', () => cancel.abort());
  try {
    return await terminal.question(question, { signal: cancel.signal });
  } catch (error) {
    if (cancel.signal.aborted) throw new HominemAuthError('Sign-in cancelled.');
    throw error;
  } finally {
    terminal.close();
  }
}

export function terminalAsk(): SetupOptions['ask'] {
  return process.stdin.isTTY && process.stdout.isTTY ? askInTerminal : undefined;
}

/** Why the configured API can't be used, or `undefined` when it answers like a Hominem API. */
async function apiProblem(fetchImpl: typeof fetch): Promise<unknown> {
  try {
    await discoverHominem(hominemApiUrl(), fetchImpl);
    return undefined;
  } catch (error) {
    return error;
  }
}

function explain(problem: unknown): string {
  if (isNetworkError(problem)) return 'Nothing answered at that address.';
  if (problem instanceof HominemAuthError) return problem.message;
  return "That address didn't answer like a Hominem API.";
}

/**
 * `hominem auth`: if the API URL doesn't work, ask for one that does, save it to the machine env
 * file, then sign in. Without anyone to ask, the original failure goes straight to the caller.
 */
export async function signInWithSetup(options: SetupOptions = {}): Promise<void> {
  const { ask, envFile = envFilePath(), ...auth } = options;
  // Checked before the env file loads: a value that's already exported beats whatever we save.
  const exported = process.env[KEY] !== undefined;
  applyEnvDefaults(envFile);
  const fetchImpl = auth.fetchImpl ?? fetch;

  let problem = await apiProblem(fetchImpl);
  const needsSetup = problem !== undefined;
  while (problem !== undefined) {
    if (!ask) throw problem;
    const current = process.env[KEY] ?? DEFAULT_API_URL;
    console.log(`\nCan't use the Hominem API at ${current}. ${explain(problem)}`);
    const answer = await ask(`Hominem API URL (press Enter for ${DEFAULT_API_URL}): `);
    process.env[KEY] = answer.trim() || DEFAULT_API_URL;
    problem = await apiProblem(fetchImpl);
  }

  if (needsSetup) {
    const url = hominemApiUrl();
    await saveEnvValue(KEY, url, envFile);
    console.log(`Saved ${KEY}=${url} to ${envFile}`);
    if (exported) {
      console.log(
        `Heads up: your environment also exports ${KEY}, and that beats the saved value.\n` +
          `Run \`unset ${KEY}\` in this terminal (and drop it from wherever you export it).`,
      );
    }
  }
  await hominemAuth(auth);
}
