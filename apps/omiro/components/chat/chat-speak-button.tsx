import type { ChatMessageItem } from '@hominem/chat';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAudioPlayback } from '~/components/media/useAudioPlayback';
import { chatKeys } from '~/services/notes/query-keys';

import { ActionIconButton } from '../ui/action-icon-button';

export function ChatSpeakButton({ message }: { message: ChatMessageItem }) {
  const audioUrl = message.audio?.url ?? null;
  const queryClient = useQueryClient();
  const { chatId, id: messageId } = message;
  const resolveUrl = useCallback(async () => {
    const queryKey = chatKeys.messages(chatId);
    await queryClient.refetchQueries({ queryKey, exact: true });
    const messages = queryClient.getQueryData<ChatMessageItem[]>(queryKey);
    return messages?.find((item) => item.id === messageId)?.audio?.url ?? null;
  }, [queryClient, chatId, messageId]);
  const playback = useAudioPlayback(message.id, audioUrl, resolveUrl);
  const isUser = message.role.toLowerCase() === 'user';
  const canSpeak =
    !isUser && !message.isStreaming && Boolean(audioUrl) && Boolean(message.message?.trim());

  if (!canSpeak) {
    return null;
  }

  return (
    <ActionIconButton
      icon={playback.isSpeaking ? 'stop.fill' : 'speaker.wave.2'}
      onPress={() => playback.toggle()}
    />
  );
}
