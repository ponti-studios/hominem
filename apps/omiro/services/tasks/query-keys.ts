import { queryKeys } from '@hominem/rpc/react';

export const taskKeys = {
  all: queryKeys.tasks.all,
  detail: (id: string) => queryKeys.tasks.detail(id),
} as const;
