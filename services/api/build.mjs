import { build } from 'rolldown';

const sharedConfig = {
  tsconfig: './tsconfig.json',
  platform: 'node',
  // Bundle all npm packages into a self-contained artifact.
  // Node.js builtins are automatically external via platform: 'node'.
  // Exclude optional native add-ons that are try/catch required by pg and ws.
  // Vite is only loaded by the development server branch. Keep that optional
  // tool out of the production bundle and its optional devtools imports.
  external: ['pg-native', 'bufferutil', 'utf-8-validate', 'vite'],
};

const target = process.argv[2] ?? 'all';

const nodeEntries =
  target === 'worker'
    ? [['src/worker.ts', 'dist/worker.mjs']]
    : [
        ['src/index.ts', 'dist/index.mjs'],
        ['src/worker.ts', 'dist/worker.mjs'],
      ];

await Promise.all([
  ...nodeEntries.map(([input, file]) =>
    build({ ...sharedConfig, input, output: { file, format: 'esm', codeSplitting: false } }),
  ),
]);
