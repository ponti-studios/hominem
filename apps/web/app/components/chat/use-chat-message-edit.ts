import { useEffect, useState } from 'react';

export function useChatMessageEdit({
  content,
  messageId,
  onEdit,
}: {
  content: string;
  messageId: string;
  onEdit?: (messageId: string, content: string) => Promise<void> | void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(content);
  }, [content, isEditing]);

  function startEditing() {
    setDraft(content);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraft(content);
    setError(null);
    setIsEditing(false);
  }

  async function save() {
    const nextContent = draft.trim();
    if (!nextContent) {
      setError('Message cannot be empty.');
      return;
    }

    try {
      await onEdit?.(messageId, nextContent);
      setError(null);
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update this message.');
    }
  }

  return {
    canEdit: Boolean(onEdit),
    cancelEditing,
    draft,
    error,
    isEditing,
    save,
    setDraft,
    startEditing,
  };
}
