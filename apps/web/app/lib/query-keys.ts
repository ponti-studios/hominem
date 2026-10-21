import { queryKeys } from '@hominem/rpc/react';
// re-exports the shared query key factory from @hominem/rpc so web and
// mobile stay on the same keys instead of drifting apart

export const notesQueryKeys = {
  search: (query: string) => queryKeys.notes.search(query),
};
