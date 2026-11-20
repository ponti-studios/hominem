// Imported first by cli.ts so EVALS_ENV_FILE (API key, EVALS_TARGET_MODEL, EVALS_JUDGE_MODEL) is
// in process.env before any module reads the model constants at import time.
if (process.env.EVALS_ENV_FILE) process.loadEnvFile(process.env.EVALS_ENV_FILE);

// Eval runs stay private and local: no telemetry, no update checks, no result sharing. promptfoo reads
// these when it is imported, so they live here (imported first), not in cli.ts after the imports.
process.env.PROMPTFOO_DISABLE_TELEMETRY = '1';
process.env.PROMPTFOO_DISABLE_UPDATE = '1';
process.env.PROMPTFOO_DISABLE_SHARING = '1';
process.env.PROMPTFOO_CONFIG_DIR ??= new URL('../runs/.promptfoo', import.meta.url).pathname;
