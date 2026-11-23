import { resolve } from 'node:path';

import { createStudioService } from '@hominem/proactivity/studio';

let service: ReturnType<typeof createStudioService> | null = null;

/**
 * The proactivity studio runs against its synthetic world and a local SQLite
 * journal. Instantiated lazily so importing the routes costs nothing until the
 * dashboard is actually opened.
 */
export function getStudioService(): ReturnType<typeof createStudioService> {
  if (!service) {
    service = createStudioService({
      dbPath: process.env.PROACTIVITY_STUDIO_DB ?? resolve(process.cwd(), '.data', 'studio.db'),
      model:
        process.env.PROACTIVITY_STUDIO_MODEL ??
        process.env.PROACTIVITY_MODEL ??
        'openai/gpt-5-mini',
      modelReady: Boolean(process.env.OPENROUTER_API_KEY),
    });
  }
  return service;
}
