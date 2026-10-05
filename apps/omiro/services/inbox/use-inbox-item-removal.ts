import type { InboxStreamItem } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';

import { clearResumeTarget, readResumeTarget } from '~/services/navigation/launch-state';

import { restoreInbox, snapshotInbox, type InboxSnapshot } from './inbox-entities';
import { removeInboxStreamItem } from './inbox-refresh';

interface UseInboxItemRemovalOptions {
  kind: InboxStreamItem['kind'];
  entityId: string;
}

interface InboxRemovalContext {
  previousInbox: InboxSnapshot;
}

// Shared optimistic-removal skeleton for every mutation that drops an item
// out of the inbox stream (archive, delete, ...): snapshot every cached
// inbox page, remove the item right away, roll back on failure.
export function useInboxItemRemoval<TVariables = void>({
  kind,
  entityId,
}: UseInboxItemRemovalOptions) {
  const queryClient = useQueryClient();

  return {
    onMutate: async (_variables: TVariables): Promise<InboxRemovalContext> => {
      const previousInbox = await snapshotInbox(queryClient);

      removeInboxStreamItem(queryClient, { kind, entityId });

      return { previousInbox };
    },
    onError: (
      _error: unknown,
      _variables: TVariables,
      context: InboxRemovalContext | undefined,
    ) => {
      if (context) {
        restoreInbox(queryClient, context.previousInbox);
      }
    },
    clearResumeTargetIfMatch: () => {
      if (readResumeTarget()?.id === entityId) {
        clearResumeTarget();
      }
    },
  };
}
