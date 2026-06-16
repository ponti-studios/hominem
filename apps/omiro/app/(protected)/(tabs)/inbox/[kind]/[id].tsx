import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import ChatDetailScreen from '../../chat/[id]';
import NoteDetailScreen from '../../notes/[id]';

export default function InboxDetailScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (kind !== 'chat' && kind !== 'note') {
      router.replace('/(protected)/(tabs)');
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
