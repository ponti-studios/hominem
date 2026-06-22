import { useCallback, useRef, useState } from 'react';

interface UseComposerDraftOptions {
  initialMessage?: string;
  onDraftChange?: (message: string) => void;
}

export function useComposerDraft({
  initialMessage = '',
  onDraftChange,
}: UseComposerDraftOptions = {}) {
  const [message, setMessageState] = useState(() => initialMessage);
  const messageRef = useRef(initialMessage);

  const applyMessage = useCallback(
    (
      nextMessage: string,
      options?: {
        persist?: boolean;
      },
    ) => {
      messageRef.current = nextMessage;
      setMessageState(nextMessage);

      if (options?.persist ?? true) {
        onDraftChange?.(nextMessage);
      }
    },
    [onDraftChange],
  );

  const setMessage = useCallback(
    (nextMessage: string) => applyMessage(nextMessage),
    [applyMessage],
  );

  const clearDraft = useCallback(
    () =>
      applyMessage('', {
      }),
    [applyMessage],
  );

  return {
    getMessage: () => messageRef.current,
    message,
    setMessage,
    clearDraft,
  };
}
