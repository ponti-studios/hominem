import type { InboxOutput } from '@hominem/rpc/react';
import { useRpcQuery } from '@hominem/rpc/react';

interface UseInboxOptions {
  initialData?: InboxOutput;
}

export function useInbox(limit: number = 50, options: UseInboxOptions = {}) {
  return useRpcQuery(
    async (client) => {
      const query: { limit?: string } = {};
      if (limit) query.limit = String(limit);
      const res = await client.api.inbox.$get({ query });
      return res.json() as Promise<InboxOutput>;
    },
    {
      queryKey: ['inbox', { limit }],
      staleTime: 1000 * 30,
      ...(options.initialData ? { initialData: options.initialData } : {}),
    },
  );
}
