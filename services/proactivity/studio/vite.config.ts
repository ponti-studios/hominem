import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
