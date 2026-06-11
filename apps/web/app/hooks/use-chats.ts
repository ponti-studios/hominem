import type { HonoClient } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboxQueryKeys } from '~/lib/query-keys';

type ArchiveChatOutput = Awaited<
  ReturnType<Awaited<ReturnType<HonoClient['api']['chats'][':id']['archive']['$post']>>['json']>
>;

export function useCreateChat() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title }: { title: string }) =>
      client.api.chats.$post({ json: { title } }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
    },
  });
}

export function useArchiveChat({
  chatId,
  onSuccess,
}: {
  chatId: string;
  onSuccess?: (chat: ArchiveChatOutput) => void;
}) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ArchiveChatOutput, Error, void>({
    mutationFn: () => client.api.chats[':id'].archive.$post({ param: { id: chatId } }).then((r) => r.json()),
    onSuccess: (chat) => {
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
      onSuccess?.(chat);
    },
  });
}
