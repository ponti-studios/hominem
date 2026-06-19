import { Redirect, useLocalSearchParams } from 'expo-router';

import { getWorkspaceArtifactRoute } from '~/services/workspace/routes';

export default function LegacyChatRoute() {
  const { id, initialMessage } = useLocalSearchParams<{ id?: string; initialMessage?: string }>();
  const chatId = String(id ?? '');

  if (!chatId) {
    return null;
  }

  return (
    <Redirect
      href={
        initialMessage
          ? getWorkspaceArtifactRoute('chat', chatId, { initialMessage })
          : getWorkspaceArtifactRoute('chat', chatId)
      }
    />
  );
}
