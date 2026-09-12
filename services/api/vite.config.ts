import path from 'node:path';

import { defineConfig } from 'vite';

const loginRoot = path.resolve(import.meta.dirname, 'src/routes/login');

export default defineConfig({
  appType: 'custom',
  build: {
    manifest: true,
    outDir: 'dist/public',
    rollupOptions: {
      input: {
        'login-assets': path.join(loginRoot, 'client-assets.ts'),
        login: path.join(loginRoot, 'browser.ts'),
        settings: path.join(loginRoot, 'settings.ts'),
        'settings-ai': path.join(loginRoot, 'settings-ai.ts'),
        'settings-ai-footprint': path.join(loginRoot, 'settings-ai-footprint.ts'),
      },
      // Keep CSS-only entry exports alive so Vite emits the shared stylesheet.
      preserveEntrySignatures: 'strict',
    },
  },
  css: {
    modules: {
      generateScopedName(name, filename) {
        const module = path.basename(filename, '.module.css');
        return `hominem-${module}__${name}`;
      },
    },
  },
});
