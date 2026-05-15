import { build } from 'rolldown';

const sharedConfig = {
  platform: 'node',
  // Bundle @hominem/* workspace packages into the artifact.
  // Keep all other npm packages external so they resolve from node_modules at runtime.
  external(id) {
    if (id.startsWith('@hominem/')) return false;
    return /^[^./]/.test(id);
  },
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
