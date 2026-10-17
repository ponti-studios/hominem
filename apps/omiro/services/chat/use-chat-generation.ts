import { ChatClient } from '@hominem/chat/client';
import type { ChatGenerationController, GenerationClientInputEvent } from '@hominem/chat/client';
import { xhrChatTransport } from '@hominem/chat/transport/xhr';
import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE_URL } from '~/constants';

import { toGenerationStage, type ChatGenerationState } from './chat-generation';
import {
  clearGenerationCheckpoint,
  createGenerationCheckpointStore,
  persistGenerationCheckpoint,
  restoreGenerationCheckpoint,
} from './chat-generation-checkpoint';
import {
  clearGenerationHandoff,
  peekGenerationHandoff,
  registerGenerationHandoff,
  takeGenerationHandoff,
  type PendingGenerationHandoff,
} from './generation-handoff';

const resumingGenerationIds = new Set<string>();

interface UseChatGenerationOptions {
  chatId: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  onGenerationTerminal?: (event?: GenerationClientInputEvent) => void | Promise<void>;
  onGenerationEvent?: (event: GenerationClientInputEvent, generation: ChatGenerationState) => void;
}

export function useChatGeneration({
  chatId,
  getAuthHeaders,
  onGenerationTerminal,
  onGenerationEvent,
}: UseChatGenerationOptions) {
  const [client] = useState(
    () =>
      new ChatClient({
        baseUrl: API_BASE_URL,
        headers: getAuthHeaders,
        transport: xhrChatTransport(),
        checkpointStore: createGenerationCheckpointStore(chatId),
      }),
  );
  const controllerRef = useRef<ChatGenerationController | null>(null);

  // Read during render; consume after commit so StrictMode's repeated
  // initializer calls do not discard a live controller.
  const [{ initialGeneration, handoff }] = useState<{
    initialGeneration: ChatGenerationState | null;
    handoff: PendingGenerationHandoff | null;
  }>(() => {
    const available = peekGenerationHandoff(chatId) ?? null;
    const restored = restoreGenerationCheckpoint(chatId);
    if (!available) {
      return { initialGeneration: restored, handoff: null };
    }
    const state = available.controller.state;
    // Already finished by the time this screen mounted -- the message is
    // already in the query cache from the handoff site; nothing to stream.
    if (state.phase === 'committed' || state.phase === 'cancelled') {
      return { initialGeneration: null, handoff: available };
    }
    return {
      initialGeneration: {
        ...(restored?.id === state.generationId ? restored : {}),
        id: state.generationId,
        chatId,
        stage: toGenerationStage(state.phase),
        lastDurableSequence: state.lastDurableSequence,
        ...(available.userMessageId ? { userMessageId: available.userMessageId } : {}),
      },
      handoff: available,
    };
  });
  const adoptedHandoffRef = useRef<ChatGenerationController | null>(null);
  const generationRef = useRef<ChatGenerationState | null>(initialGeneration);
  const [generation, setGenerationState] = useState(initialGeneration);

  const setGeneration = useCallback(
    (next: ChatGenerationState | null) => {
      generationRef.current = next;
      setGenerationState(next);
      if (!next) {
        clearGenerationCheckpoint(chatId);
        return;
      }
      persistGenerationCheckpoint(chatId, next);
    },
    [chatId],
  );

  const bindController = useCallback(
    (
      controller: ChatGenerationController,
      initial: ChatGenerationState,
      adoptServerGenerationId = false,
    ) => {
      controllerRef.current = controller;
      setGeneration(initial);
      let canAdoptServerGenerationId = adoptServerGenerationId;
      const unsubscribe = controller.subscribe((state, event) => {
        const current = generationRef.current;
        if (!current || (current.id !== state.generationId && !canAdoptServerGenerationId)) {
          return;
        }
        const currentGeneration =
          current.id === state.generationId ? current : { ...current, id: state.generationId };
        if (currentGeneration !== current) {
          canAdoptServerGenerationId = false;
          setGeneration(currentGeneration);
        }
        if (state.phase === 'committed' || state.phase === 'cancelled') {
          onGenerationEvent?.(event, currentGeneration);
          queueMicrotask(() => {
            if (generationRef.current?.id !== state.generationId) {
              return;
            }
            setGeneration(null);
            void onGenerationTerminal?.(event);
          });
          return;
        }
        const currentState = { ...currentGeneration };
        if (state.lastDurableSequence > 0) {
          delete currentState.retryInput;
        }
        const error =
          'event' in event
            ? event.event.message
            : event.type === 'generation.failed'
              ? event.payload.message
              : undefined;
        setGeneration({
          ...currentState,
          stage: toGenerationStage(state.phase),
          lastDurableSequence: state.lastDurableSequence,
          ...(error ? { error } : {}),
        });
        onGenerationEvent?.(event, currentGeneration);
      });
      registerGenerationHandoff(chatId, {
        controller,
        releasePreviousSubscription: unsubscribe,
        ...(initial.userMessageId ? { userMessageId: initial.userMessageId } : {}),
      });
      void controller.done.then(
        () => {
          unsubscribe();
          clearGenerationHandoff(chatId, controller);
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }
        },
        () => {
          unsubscribe();
          clearGenerationHandoff(chatId, controller);
          if (controllerRef.current === controller) {
            controllerRef.current = null;
          }
        },
      );
      return unsubscribe;
    },
    [chatId, onGenerationEvent, onGenerationTerminal, setGeneration],
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

  const respondToToolCall = useCallback(
    (input: { messageId: string; toolCallId: string; approved: boolean }) => {
      const current = generationRef.current;
      // A restored awaiting-confirmation generation may still own a replay
      // stream. Close that client stream before opening the continuation so
      // one generation cannot publish duplicate client events.
      controllerRef.current?.cancel();
      const controller = client.respondToToolCall({
        chatId,
        messageId: input.messageId,
        toolCallId: input.toolCallId,
        ...(current ? { generationId: current.id } : {}),
        body: { approved: input.approved },
      });
      bindController(
        controller,
        current ?? {
          id: controller.state.generationId,
          chatId,
          stage: 'running',
          lastDurableSequence: 0,
          targetMessageId: input.messageId,
        },
        !current,
      );
      return controller;
    },
    [bindController, chatId, client],
  );

  const resumeGeneration = useCallback(async () => {
    const current = generationRef.current;
    if (
      !current ||
      ['committed', 'cancelled', 'failed'].includes(current.stage) ||
      resumingGenerationIds.has(current.id)
    ) {
      return;
    }
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
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
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
      // The start screen owned a listener while the chat route mounted. Once
      // this screen has subscribed, transfer event handling so commit side
      // effects (audio, haptics, task sync) run exactly once.
      handoff.releasePreviousSubscription?.();
      try {
        await handoff.controller.done;
      } finally {
        unsubscribe();
        if (controllerRef.current === handoff.controller) {
          controllerRef.current = null;
        }
      }
    },
    [bindController],
  );

  useEffect(() => {
    if (handoff) {
      if (adoptedHandoffRef.current === handoff.controller) {
        return;
      }
      const taken = takeGenerationHandoff(chatId, handoff.controller);
      if (!taken) {
        const current = handoff.controller.state;
        if (current.phase === 'committed' || current.phase === 'cancelled') {
          void handoff.controller.done.then(() => {
            if (generationRef.current?.id === current.generationId) {
              setGeneration(null);
            }
          });
        }
        return;
      }
      adoptedHandoffRef.current = handoff.controller;
      if (!generationRef.current) {
        taken.releasePreviousSubscription?.();
        return;
      }
      const current = handoff.controller.state;
      if (current.phase === 'committed' || current.phase === 'cancelled') {
        taken.releasePreviousSubscription?.();
        void handoff.controller.done.then(() => {
          if (generationRef.current?.id === current.generationId) {
            setGeneration(null);
          }
        });
        return;
      }
      const initial = {
        ...generationRef.current,
        stage: toGenerationStage(current.phase),
        lastDurableSequence: current.lastDurableSequence,
      };
      void Promise.resolve()
        .then(() => adoptHandoff(taken, initial))
        .catch(() => undefined);
      return;
    }
    if (generationRef.current) {
      void resumeGeneration().catch(() => undefined);
    }
  }, [adoptHandoff, chatId, handoff, resumeGeneration, setGeneration]);

  const cancelGeneration = useCallback(async () => {
    const current = generationRef.current;
    const controller = controllerRef.current;
    if (!current || !controller || current.stage === 'stopping') {
      return;
    }
    setGeneration({ ...current, stage: 'stopping' });
    let response: Response;
    try {
      response = await client.cancel({ chatId, generationId: current.id });
    } catch (error) {
      const latest = generationRef.current;
      if (latest?.id === current.id && latest.stage === 'stopping') {
        setGeneration({
          ...latest,
          stage: current.stage,
          error: error instanceof Error ? error.message : 'Unable to stop reply.',
        });
      }
      return;
    }
    if (generationRef.current?.id !== current.id || controllerRef.current !== controller) {
      return;
    }
    if (!response.ok) {
      const latest = generationRef.current;
      if (latest?.id === current.id && latest.stage === 'stopping') {
        setGeneration({ ...latest, stage: current.stage, error: 'Unable to stop reply.' });
      }
      return;
    }
    controller.cancel();
    // Nothing is left to show once a stop lands -- clear the generation so the
    // composer comes back, and refresh to drop the partial reply.
    setGeneration(null);
    void Promise.resolve(onGenerationTerminal?.()).catch(() => undefined);
  }, [chatId, client, onGenerationTerminal, setGeneration]);

  const dismissGeneration = useCallback(() => setGeneration(null), [setGeneration]);

  return {
    cancelGeneration,
    dismissGeneration,
    regenerateGeneration,
    respondToToolCall,
    sendGeneration,
    generation,
    generationRef,
    resumeGeneration,
    setGeneration,
  };
}
