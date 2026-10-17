import type { ChatMessageItem } from '@hominem/chat';
import { useCallback, useState } from 'react';

export function useChatMessageListEditing({
  messages,
  onEdit,
}: {
  messages: ChatMessageItem[];
  onEdit?: (messageId: string, content: string) => void;
}) {
  const [messageId, setMessageId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const message = messageId
    ? (messages.find((candidate) => candidate.id === messageId) ?? null)
    : null;

  const requestEdit = useCallback(
    (id: string) => {
      const selectedMessage = messages.find((candidate) => candidate.id === id);
      if (!selectedMessage) {
        return;
      }
      setMessageId(id);
      setDraft(selectedMessage.message);
    },
    [messages],
  );
  const close = useCallback(() => setMessageId(null), []);
  const save = useCallback(() => {
    const content = draft.trim();
    if (!messageId || !content) {
      return;
    }
    onEdit?.(messageId, content);
    setMessageId(null);
  }, [draft, messageId, onEdit]);

  return {
    close,
    draft,
    message,
    messageId,
    requestEdit,
    save,
    setDraft,
  };
}
