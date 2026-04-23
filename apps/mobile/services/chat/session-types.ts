import type { Chat } from '@hominem/rpc/types';

export interface ChatWithActivity extends Chat {
  activityAt: string;
}
