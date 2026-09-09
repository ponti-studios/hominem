import { createApiClient } from '@hominem/rpc';
import type { ChatsListOutput } from '@hominem/rpc/types/chat.types';
import { useState } from 'react';
import { data, redirect, useNavigate } from 'react-router';

import { ChatHomePage } from '~/components/chat/chat-home-page';
import { normalizeChatTitle } from '~/lib/chat/chat-title';
import { serverEnv } from '~/lib/env.server';
import { useOnlineStatus } from '~/lib/hooks/use-online-status';
import { useResponseLength } from '~/lib/hooks/use-response-length';
import { useStartChat } from '~/lib/hooks/use-start-chat';

import type { Route } from './+types/home';

// React Router requires route loaders to be exported from route modules.
// This is intentionally a framework boundary, not a component module export.
// eslint-disable-next-line react-doctor/only-export-components
export async function loader({ request }: Route.LoaderArgs) {
  const apiClient = createApiClient({
    baseUrl: serverEnv.HOMINEM_INTERNAL_API_URL,
    request,
    throwOnError: false,
  });
  const cookie = request.headers.get('cookie');
  const headers = cookie ? { cookie } : undefined;

  const listResponse = await apiClient.api.chats.$get(
    { query: { limit: '1' } },
    { headers, init: { signal: request.signal } },
  );
  const chats: ChatsListOutput['items'] = listResponse.ok ? (await listResponse.json()).items : [];

  if (chats[0]?.id) {
    throw redirect(`/chat/${chats[0].id}`);
  }

  return data({ hasChats: false });
}

export default function HomePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const startChat = useStartChat();
  const isOnline = useOnlineStatus();
  const { responseLength } = useResponseLength();

  async function handleSubmit() {
    const message = draft.trim();
    if (!message || startChat.isStarting || !isOnline) return;

    await startChat.start({
      message,
      title: normalizeChatTitle(message),
      responseLength,
      onAccepted: (event) => {
        setDraft('');
        navigate(`/chat/${event.payload.chatId}`, { viewTransition: true });
      },
    });
  }

  return (
    <ChatHomePage
      draft={draft}
      error={startChat.error?.message}
      isOffline={!isOnline}
      isSubmitting={startChat.isStarting}
      onChangeDraft={setDraft}
      onSubmit={() => void handleSubmit()}
    />
  );
}
