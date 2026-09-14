import type { ChatGenerationController } from '@hominem/chat/client';

// Same-process handoff for a generation whose ChatClient was created on the
// screen that started it (the new-chat flow) to the screen that finishes
// showing it (the chat screen, mounted fresh after router.replace swaps in
// the real chatId and unmounts the new-chat screen). This only needs to
// survive the moment between those two mounts within one running app
// instance -- never an app restart, which is what MMKV checkpoint
// persistence is for and is unaffected by this. Handing over the live
// controller means the destination screen adopts the generation already in
// flight instead of opening a second SSE connection and reconstructing
// state from storage.
export interface PendingGenerationHandoff {
  controller: ChatGenerationController;
  userMessageId?: string;
}

const pending = new Map<string, PendingGenerationHandoff>();

export function registerGenerationHandoff(chatId: string, handoff: PendingGenerationHandoff): void {
  pending.set(chatId, handoff);
}

// One-shot: the first screen to ask for a chatId's handoff gets it, and
// it's gone for anyone asking again -- including a React StrictMode dev
// double-mount, which just falls back to the normal MMKV-restore path for
// that one extra mount rather than adopting the live controller twice.
export function takeGenerationHandoff(chatId: string): PendingGenerationHandoff | undefined {
  const handoff = pending.get(chatId);
  pending.delete(chatId);
  return handoff;
}
