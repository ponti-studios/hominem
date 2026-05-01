import { useInbox as useInboxQuery } from '@hominem/rpc/react';

export function useInbox(limit: number = 50) {
  return useInboxQuery({ limit });
}
