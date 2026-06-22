import { Redirect, useLocalSearchParams } from 'expo-router';

import { ChatDetailScreen } from '~/components/workspace/ChatDetailScreen';
import { NoteDetailScreen } from '~/components/workspace/NoteDetailScreen';
import { getWorkspaceHomeRoute } from '~/services/workspace/routes';

export default function InboxDetailScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string; id?: string }>();

  if (kind !== 'chat' && kind !== 'note') {
    return <Redirect href={getWorkspaceHomeRoute()} />;
  }

  if (kind === 'chat') {
    return <ChatDetailScreen />;
  }

  return <NoteDetailScreen />;
}
