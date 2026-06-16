import { cpSync, mkdirSync } from 'node:fs';

import { build } from 'rolldown';

// hono-openapi@1.3.0 statically imports @hono/standard-validator (optional peer dep
// we don't install — we use @hono/zod-validator instead). Stub it so the bundle
// doesn't emit an unresolvable import that crashes Node.js at startup.
const stubMissingPeerDeps = {
  name: 'stub-missing-peer-deps',
  resolveId(id) {
    if (id === '@hono/standard-validator') return '\0stub:' + id;
  },
  load(id) {
    if (id.startsWith('\0stub:')) return 'export const sValidator = undefined;';
  },
};

const sharedConfig = {
  platform: 'node',
  // Bundle all npm packages into a self-contained artifact.
  // Node.js builtins are automatically external via platform: 'node'.
  // Exclude optional native add-ons that are try/catch required by pg and ws.
  external: ['pg-native', 'bufferutil', 'utf-8-validate'],
  plugins: [stubMissingPeerDeps],
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

mkdirSync('dist/prompts', { recursive: true });
cpSync('src/rpc/prompts', 'dist/prompts', { recursive: true });
