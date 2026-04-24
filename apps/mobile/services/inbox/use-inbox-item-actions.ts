import { useApiClient } from '@hominem/rpc/react';
import type { Note } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { chatKeys, noteKeys } from '~/services/notes/query-keys';

type AnimateExit = (onComplete: () => void) => void;

export function useInboxItemActions(item: InboxStreamItemData, animateExit: AnimateExit) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  function handleDeleteNote() {
    Alert.alert('Delete note', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          animateExit(async () => {
            await client.api.notes[':id'].$delete({ param: { id: item.entityId } });
            queryClient.setQueryData<Note[]>(noteKeys.all, (current) =>
              current?.filter((n) => n.id !== item.entityId),
            );
            void queryClient.invalidateQueries({ queryKey: noteKeys.feeds() });
          });
        },
      },
    ]);
  }

  function handleArchiveChat() {
    Alert.alert('Archive chat', 'This chat will be moved to your archive.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          animateExit(async () => {
            await client.api.chats[':id'].archive.$post({ param: { id: item.entityId } });
            queryClient.setQueryData<ChatWithActivity[]>(chatKeys.resumableSessions, (current) =>
              current?.filter((c) => c.id !== item.entityId),
            );
          });
        },
      },
    ]);
  }

  return { handleDeleteNote, handleArchiveChat };
}
