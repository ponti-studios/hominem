// Shared rolldown config for the hosted-login page's client bundle
// (src/routes/login/browser.ts -> public/login.js). Used by both the
// one-shot production build (build.mjs) and the dev watcher (dev.mjs) so
// they can never drift apart.
export const loginClientBuildOptions = {
  tsconfig: './tsconfig.json',
  platform: 'browser',
  input: 'src/routes/login/browser.ts',
  output: {
    file: 'public/login.js',
    format: 'iife',
    codeSplitting: false,
  },
};

export const settingsClientBuildOptions = {
  tsconfig: './tsconfig.json',
  platform: 'browser',
  input: 'src/routes/login/settings.ts',
  output: {
    file: 'public/settings.js',
    format: 'iife',
    codeSplitting: false,
  },
};

export const settingsAiClientBuildOptions = {
  tsconfig: './tsconfig.json',
  platform: 'browser',
  input: 'src/routes/login/settings-ai.ts',
  output: {
    file: 'public/settings-ai.js',
    format: 'iife',
    codeSplitting: false,
  },
};

export const settingsAiFootprintClientBuildOptions = {
  tsconfig: './tsconfig.json',
  platform: 'browser',
  input: 'src/routes/login/settings-ai-footprint.ts',
  output: {
    file: 'public/settings-ai-footprint.js',
    format: 'iife',
    codeSplitting: false,
  },
};
