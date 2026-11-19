// Imported first by cli.ts so EVALS_ENV_FILE (API key, EVALS_TARGET_MODEL, EVALS_JUDGE_MODEL) is
// in process.env before any module reads the model constants at import time.
if (process.env.EVALS_ENV_FILE) process.loadEnvFile(process.env.EVALS_ENV_FILE);
