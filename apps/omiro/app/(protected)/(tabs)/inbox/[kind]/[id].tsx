import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ChatDetailScreen } from '~/components/workspace/ChatDetailScreen';
import { NoteDetailScreen } from '~/components/workspace/NoteDetailScreen';
import { getWorkspaceHomeRoute } from '~/services/workspace/routes';

export default function InboxDetailScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (kind !== 'chat' && kind !== 'note') {
      router.replace(getWorkspaceHomeRoute());
    }
  }, [kind, router]);

  if (kind === 'chat') {
    return <ChatDetailScreen />;
  }

  if (kind === 'note') {
    return <NoteDetailScreen />;
  }

  return null;
}
