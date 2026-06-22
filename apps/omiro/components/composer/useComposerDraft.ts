import { useCallback, useEffect, useRef, useState } from 'react';

interface UseComposerDraftOptions {
  initialMessage?: string;
  hydrationKey?: string;
  onDraftChange?: (message: string) => void;
}

export function useComposerDraft({
  initialMessage = '',
  hydrationKey,
  onDraftChange,
}: UseComposerDraftOptions = {}) {
  const [message, setMessageState] = useState(() => initialMessage);
  const messageRef = useRef(initialMessage);
  const hydratedKeyRef = useRef(hydrationKey);
  const hasLocalEditsRef = useRef(false);

  const applyMessage = useCallback(
    (
      nextMessage: string,
      options?: {
        markEdited?: boolean;
        persist?: boolean;
      },
    ) => {
      messageRef.current = nextMessage;
      setMessageState(nextMessage);

      if (options?.markEdited ?? true) {
        hasLocalEditsRef.current = true;
      } else {
        hasLocalEditsRef.current = false;
      }

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
        markEdited: false,
      }),
    [applyMessage],
  );

  useEffect(() => {
    if (!hydrationKey || hydratedKeyRef.current === hydrationKey) {
      return;
    }

    hydratedKeyRef.current = hydrationKey;
    if (hasLocalEditsRef.current) {
      return;
    }

    applyMessage(initialMessage, {
      markEdited: false,
      persist: false,
    });
  }, [applyMessage, hydrationKey, initialMessage]);

  return {
    getMessage: () => messageRef.current,
    message,
    setMessage,
    clearDraft,
  };
}
