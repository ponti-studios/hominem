import { readFileSync } from 'node:fs';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'python-text',
      enforce: 'pre',
      transform(_code, id) {
        if (!id.endsWith('.py')) return null;
        return {
          code: `export default ${JSON.stringify(readFileSync(id, 'utf8'))}`,
          map: null,
        };
      },
    },
  ],
});
