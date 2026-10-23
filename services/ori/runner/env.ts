// Imported first by cli.ts so ORI_ENV_FILE (API key, ORI_TARGET_MODEL, ORI_JUDGE_MODEL) is
// in process.env before any module reads the model constants at import time.
if (process.env.ORI_ENV_FILE) process.loadEnvFile(process.env.ORI_ENV_FILE);
