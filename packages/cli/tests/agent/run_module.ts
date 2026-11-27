import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , file, ...args] = process.argv;
if (!file) throw new Error('run_module: missing module path');

const modulePath = resolve(file);
process.argv = [process.execPath, modulePath, ...args];
const module = (await import(pathToFileURL(modulePath).href)) as {
  main?: (argv?: string[]) => number | Promise<number> | void | Promise<void>;
};
if (!module.main) throw new Error(`run_module: ${modulePath} has no main export`);
const result = await module.main(args);
if (typeof result === 'number') process.exitCode = result;
