import type { Chat } from '@hominem/rpc/types';

export type ChatWithActivity = Chat & {
  archivedAt: string | null;
  activityAt: string;
};
