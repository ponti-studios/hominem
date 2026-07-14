import path from 'node:path'

import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
  },
  clearScreen: false,
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './app'),
    },
    tsconfigPaths: true,
  },
  server: {
    port: 4451,
    strictPort: true,
  },
})
