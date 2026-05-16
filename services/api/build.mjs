import { build } from 'rolldown';

const sharedConfig = {
  platform: 'node',
  // Bundle all npm packages into a self-contained artifact.
  // Node.js builtins are automatically external via platform: 'node'.
  // Exclude optional native add-ons that are try/catch required by pg and ws.
  external: ['pg-native', 'bufferutil', 'utf-8-validate'],
};

await Promise.all([
  build({
    ...sharedConfig,
    input: 'src/index.ts',
    output: { file: 'dist/index.mjs', format: 'esm', codeSplitting: false },
  }),
  build({
    ...sharedConfig,
    input: 'src/worker.ts',
    output: { file: 'dist/worker.mjs', format: 'esm', codeSplitting: false },
  }),
]);
