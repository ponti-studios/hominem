import { Redirect, useLocalSearchParams } from 'expo-router';

import { ChatScreen } from '~/components/inbox/ChatScreen';
import { CHAT_ROUTE } from '~/services/navigation/routes';

export default function ChatDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (!id) {
    return <Redirect href={CHAT_ROUTE} />;
  }

  return <ChatScreen id={id} />;
}
