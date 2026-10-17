import type { ChatGenerationController } from '@hominem/chat/client';

// Keeps an active controller discoverable when a chat screen remounts, so it
// can adopt the existing stream. MMKV checkpoints handle app restarts.
export interface PendingGenerationHandoff {
  controller: ChatGenerationController;
  releasePreviousSubscription?: () => void;
  userMessageId?: string;
}

const active = new Map<string, PendingGenerationHandoff>();

export function registerGenerationHandoff(chatId: string, handoff: PendingGenerationHandoff): void {
  active.set(chatId, handoff);
}

export function peekGenerationHandoff(chatId: string): PendingGenerationHandoff | undefined {
  return active.get(chatId);
}

export function takeGenerationHandoff(
  chatId: string,
  expectedController?: ChatGenerationController,
): PendingGenerationHandoff | undefined {
  const handoff = active.get(chatId);
  if (expectedController && handoff?.controller !== expectedController) {
    return undefined;
  }
  active.delete(chatId);
  return handoff;
}

export function clearGenerationHandoff(chatId: string, controller: ChatGenerationController): void {
  if (active.get(chatId)?.controller === controller) {
    active.delete(chatId);
  }
}
