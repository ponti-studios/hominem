import {
  ChatClient,
  parseGenerationClientCheckpoint,
  toGenerationClientCheckpoint,
} from '@hominem/chat/client';
import type { ChatGenerationController, GenerationClientState } from '@hominem/chat/client';
import { xhrChatTransport } from '@hominem/chat/transport/xhr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '~/constants';
import { storage } from '~/services/storage/mmkv';

import type { ChatGenerationState } from './chat-generation';
import { takeGenerationHandoff, type PendingGenerationHandoff } from './generation-handoff';

const resumingGenerationIds = new Set<string>();

function generationStorageKey(id: string) {
  return `chat-generation:${id}`;
}

// userMessageId rides alongside the shared, strictly-typed checkpoint —
// it's an Omiro-only concern (Retry needs it; the wire checkpoint schema
// doesn't carry it), so it's stripped before validating the rest and
// re-attached after, rather than widening the shared schema for one field.
function readStoredCheckpoint(chatId: string): {
  checkpoint: ReturnType<typeof parseGenerationClientCheckpoint>;
  userMessageId?: string;
} | null {
  const raw = storage.getString(generationStorageKey(chatId));
  if (!raw) return null;
  const { userMessageId, ...rest } = JSON.parse(raw) as { userMessageId?: unknown };
  const checkpoint = parseGenerationClientCheckpoint(rest);
  return {
    checkpoint,
    ...(typeof userMessageId === 'string' ? { userMessageId } : {}),
  };
}

function restoreGeneration(chatId: string): ChatGenerationState | null {
  try {
    const stored = readStoredCheckpoint(chatId);
    if (!stored) return null;
    const { checkpoint, userMessageId } = stored;
    return {
      id: checkpoint.generationId,
      chatId,
      stage: checkpoint.phase === 'cancel_requested' ? 'stopping' : checkpoint.phase,
      lastDurableSequence: checkpoint.lastDurableSequence,
      ...(userMessageId ? { userMessageId } : {}),
    };
  } catch {
    storage.remove(generationStorageKey(chatId));
    return null;
  }
}

// Writes the same MMKV checkpoint shape `restoreGeneration` reads, under the
// same chatId-scoped key. Exported so a generation started from outside this
// hook (e.g. the new-chat creation flow, which owns its own ChatClient) can
// seed this hook's initial state before the consuming screen ever mounts.
export function persistGenerationCheckpoint(
  chatId: string,
  state: Pick<ChatGenerationState, 'id' | 'stage' | 'lastDurableSequence' | 'userMessageId'>,
) {
  const checkpoint = parseGenerationClientCheckpoint({
    generationId: state.id,
    phase: state.stage === 'stopping' ? 'cancel_requested' : state.stage,
    lastDurableSequence: state.lastDurableSequence,
  });
  storage.set(
    generationStorageKey(chatId),
    JSON.stringify({
      ...checkpoint,
      ...(state.userMessageId ? { userMessageId: state.userMessageId } : {}),
    }),
  );
}

// Backs the ChatClient's own internal resume bookkeeping (`get`/`set` keyed
// by generationId, used by its start/resume mid-stream logic) — sharing the
// same MMKV slot `persistGenerationCheckpoint` seeds and `restoreGeneration`
// reads. `set` used to write the full `GenerationClientState` verbatim,
// which the strict wire checkpoint schema then rejected on the next read
// (extra fields), silently deleting the checkpoint after the first streamed
// update. Normalizing through `toGenerationClientCheckpoint` here keeps
// every writer to this key on the one schema `restoreGeneration` expects,
// and preserves any `userMessageId` already seeded rather than clobbering it —
// ChatClient itself never knows about that field.
function checkpointStore(chatId: string) {
  return {
    get: (_id: string) => {
      try {
        const stored = readStoredCheckpoint(chatId);
        if (!stored) return null;
        return { ...stored.checkpoint } as GenerationClientState;
      } catch {
        return null;
      }
    },
    set: (state: GenerationClientState) => {
      let userMessageId: string | undefined;
      try {
        userMessageId = readStoredCheckpoint(chatId)?.userMessageId;
      } catch {
        // Malformed existing value — drop it rather than propagate it forward.
      }
      const checkpoint = toGenerationClientCheckpoint(state);
      storage.set(
        generationStorageKey(chatId),
        JSON.stringify({ ...checkpoint, ...(userMessageId ? { userMessageId } : {}) }),
      );
    },
    remove: (_id: string) => {
      storage.remove(generationStorageKey(chatId));
    },
  };
}

interface UseChatGenerationOptions {
  chatId: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onGenerationTerminal?: () => void | Promise<void>;
}

export function useChatGeneration({
  chatId,
  getAuthHeaders,
  onGenerationTerminal,
}: UseChatGenerationOptions) {
  const [client] = useState(
    () =>
      new ChatClient({
        baseUrl: API_BASE_URL,
        headers: getAuthHeaders,
        transport: xhrChatTransport(),
        checkpointStore: checkpointStore(chatId),
      }),
  );
  const controllerRef = useRef<ChatGenerationController | null>(null);

  // One-time take, done inside useState's lazy initializer rather than by
  // mutating a ref during render: React may invoke this initializer twice
  // under StrictMode in dev, but only the first call actually consumes the
  // handoff -- a second call (or a real second mount) finds it already gone
  // and falls back to the normal MMKV restore below, which is correct, just
  // not the fast path.
  const [{ initialGeneration, handoff }] = useState<{
    initialGeneration: ChatGenerationState | null;
    handoff: PendingGenerationHandoff | null;
  }>(() => {
    const taken = takeGenerationHandoff(chatId) ?? null;
    if (!taken) return { initialGeneration: restoreGeneration(chatId), handoff: null };
    const state = taken.controller.state;
    // Already finished by the time this screen mounted -- the message is
    // already in the query cache from the handoff site; nothing to stream.
    if (state.phase === 'committed' || state.phase === 'cancelled') {
      return { initialGeneration: null, handoff: null };
    }
    return {
      initialGeneration: {
        id: state.generationId,
        chatId,
        stage: state.phase === 'cancel_requested' ? 'stopping' : state.phase,
        lastDurableSequence: state.lastDurableSequence,
        ...(taken.userMessageId ? { userMessageId: taken.userMessageId } : {}),
      },
      handoff: taken,
    };
  });
  const generationRef = useRef<ChatGenerationState | null>(initialGeneration);
  const [generation, setGenerationState] = useState(generationRef.current);

  const setGeneration = useCallback(
    (next: ChatGenerationState | null) => {
      generationRef.current = next;
      setGenerationState(next);
      if (!next) {
        storage.remove(generationStorageKey(chatId));
        return;
      }
      persistGenerationCheckpoint(chatId, next);
    },
    [chatId],
  );

  const bindController = useCallback(
    (controller: ChatGenerationController, initial: ChatGenerationState) => {
      controllerRef.current = controller;
      setGeneration(initial);
      return controller.subscribe((state) => {
        const current = generationRef.current;
        if (!current || current.id !== state.generationId) return;
        if (state.phase === 'committed' || state.phase === 'cancelled') {
          queueMicrotask(() => {
            if (generationRef.current?.id !== state.generationId) return;
            setGeneration(null);
            void onGenerationTerminal?.();
          });
          return;
        }
        setGeneration({
          ...current,
          stage: state.phase === 'cancel_requested' ? 'stopping' : state.phase,
          lastDurableSequence: state.lastDurableSequence,
        });
      });
    },
    [onGenerationTerminal, setGeneration],
  );

  const sendGeneration = useCallback(
    (input: Parameters<ChatClient['send']>[0], initial: ChatGenerationState) => {
      const controller = client.send(input);
      bindController(controller, initial);
      return controller;
    },
    [bindController, client],
  );

  const regenerateGeneration = useCallback(
    (input: Parameters<ChatClient['regenerate']>[0], initial: ChatGenerationState) => {
      const controller = client.regenerate(input);
      bindController(controller, initial);
      return controller;
    },
    [bindController, client],
  );

  const resumeGeneration = useCallback(async () => {
    const current = generationRef.current;
    if (
      !current ||
      ['committed', 'cancelled', 'failed'].includes(current.stage) ||
      resumingGenerationIds.has(current.id)
    )
      return;
    resumingGenerationIds.add(current.id);
    const controller = client.resumeGeneration({
      chatId,
      generationId: current.id,
    });
    const unsubscribe = bindController(controller, current);
    try {
      await controller.done;
    } finally {
      unsubscribe();
      resumingGenerationIds.delete(current.id);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [bindController, chatId, client]);

  // Adopts a handed-off controller in place of opening a new SSE connection:
  // subscribes to the same controller the previous screen already had
  // streaming, rather than calling client.resumeGeneration() (which would
  // start a second one). Mirrors resumeGeneration's own lifecycle handling
  // so the two converge to the same steady state once bound.
  const adoptHandoff = useCallback(
    async (handoff: PendingGenerationHandoff, initial: ChatGenerationState) => {
      const unsubscribe = bindController(handoff.controller, initial);
      try {
        await handoff.controller.done;
      } finally {
        unsubscribe();
        if (controllerRef.current === handoff.controller) controllerRef.current = null;
      }
    },
    [bindController],
  );

  useEffect(() => {
    if (handoff && generationRef.current) {
      void adoptHandoff(handoff, generationRef.current).catch(() => undefined);
      return;
    }
    if (generationRef.current) void resumeGeneration().catch(() => undefined);
  }, [adoptHandoff, handoff, resumeGeneration]);

  const cancelGeneration = useCallback(async () => {
    const current = generationRef.current;
    const controller = controllerRef.current;
    if (!current || !controller || current.stage === 'stopping') return;
    setGeneration({ ...current, stage: 'stopping' });
    const response = await client.cancel({ chatId, generationId: current.id });
    if (!response.ok) {
      setGeneration({ ...current, stage: 'failed', error: 'Unable to stop reply.' });
      return;
    }
    controller.cancel();
    setGeneration({ ...current, stage: 'cancelled' });
  }, [chatId, client, setGeneration]);

  return {
    cancelGeneration,
    regenerateGeneration,
    sendGeneration,
    generation,
    generationRef,
    resumeGeneration,
    setGeneration,
  };
}
