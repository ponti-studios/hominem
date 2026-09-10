import {
  ChatClient,
  createGenerationClientState,
  parseGenerationClientCheckpoint,
  toGenerationClientCheckpoint,
} from '@hominem/chat/client';
import type { GenerationClientState } from '@hominem/chat/client';
import { fetchChatTransport } from '@hominem/chat/transport/fetch';
import { useRef } from 'react';

// Keyed by chatId, not the generationId the store's own get/set/remove
// signature takes — a reload knows the chatId (it's in the URL) but not
// which generationId to look up, so "the latest checkpoint for this chat"
// has to live at a chatId-addressable key. This mirrors apps/omiro's
// checkpointStore, which closes over chatId the same way.
//
// Stores the narrowed GenerationClientCheckpoint shape, not the full
// GenerationClientState — generationClientCheckpointSchema is `.strict()`,
// so persisting extra fields (text/reasoning/toolSteps/error) makes
// parseGenerationClientCheckpoint throw on the next read, silently
// discarding the checkpoint (its caller's catch clears storage on any parse
// failure). use-stream-message.ts's own restore path reads this same key
// with that same strict parser, so the two must agree on the stored shape.
function createCheckpointStore(chatId: string) {
  const storage = typeof window === 'undefined' ? undefined : window.localStorage;
  const key = `chat-generation:${chatId}`;
  return {
    get: (): GenerationClientState | null => {
      if (!storage) return null;
      const raw = storage.getItem(key);
      if (!raw) return null;
      try {
        const checkpoint = parseGenerationClientCheckpoint(JSON.parse(raw));
        return { ...createGenerationClientState(checkpoint.generationId), ...checkpoint };
      } catch {
        storage.removeItem(key);
        return null;
      }
    },
    set: (state: GenerationClientState) => {
      storage?.setItem(key, JSON.stringify(toGenerationClientCheckpoint(state)));
    },
    remove: () => storage?.removeItem(key),
  };
}

export function useChatClient(chatId: string) {
  const clientRef = useRef<ChatClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new ChatClient({
      baseUrl: import.meta.env.VITE_PUBLIC_API_URL,
      transport: fetchChatTransport((input, init) =>
        fetch(input, { ...init, credentials: 'include' }),
      ),
      checkpointStore: createCheckpointStore(chatId),
    });
  }
  return clientRef.current;
}
