import { Flags } from '@oclif/core';

/** Flags both sync commands take. `sync` in wealth.ts checks the dates. */
export const syncFlags = {
  from: Flags.string({ description: 'First date to sync (YYYY-MM-DD)' }),
  until: Flags.string({ description: 'Last date to sync (YYYY-MM-DD, default today in UTC)' }),
  'dry-run': Flags.boolean({ description: 'Show what would change without saving it' }),
};
