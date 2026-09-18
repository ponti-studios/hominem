import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const loginRoot = path.resolve(import.meta.dirname, 'src/routes/login');

export default defineConfig({
  appType: 'custom',
  plugins: [tailwindcss()],
  build: {
    manifest: true,
    outDir: 'dist/public',
    rollupOptions: {
      input: {
        login: path.join(loginRoot, 'app/entries/login.tsx'),
        consent: path.join(loginRoot, 'app/entries/consent.tsx'),
        logout: path.join(loginRoot, 'app/entries/logout.tsx'),
        error: path.join(loginRoot, 'app/entries/error.tsx'),
        settings: path.join(loginRoot, 'app/entries/settings.tsx'),
        'settings-ai': path.join(loginRoot, 'app/entries/settings-ai.tsx'),
        'settings-ai-footprint': path.join(loginRoot, 'app/entries/settings-ai-footprint.tsx'),
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