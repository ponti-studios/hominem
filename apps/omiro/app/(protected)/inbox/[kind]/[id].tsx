import { Redirect, useLocalSearchParams } from 'expo-router';

import { ChatDetailScreen } from '~/components/inbox/ChatDetailScreen';
import { NoteDetailScreen } from '~/components/inbox/NoteDetailScreen';
import { getInboxRoute } from '~/services/navigation/routes';

export default function InboxDetailScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string; id?: string }>();

  if (kind !== 'chat' && kind !== 'note') {
    return <Redirect href={getInboxRoute()} />;
  }

  if (kind === 'chat') {
    return <ChatDetailScreen />;
  }

  return <NoteDetailScreen />;
}
