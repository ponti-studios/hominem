import type { GenerationPhase } from '@hominem/chat';

export type ChatGenerationStage =
  | 'preparing'
  | 'running'
  | 'awaiting_confirmation'
  | 'stopping'
  | 'failed'
  | 'cancelled'
  | 'committed';

export interface ChatGenerationState {
  id: string;
  chatId: string;
  stage: ChatGenerationStage;
  lastDurableSequence: number;
  targetMessageId?: string;
  userMessageId?: string;
  error?: string;
}

// The server's short `saving` phase (committing the finished reply) is not a
// state the person sees or can act on, so it reads as still running.
export function toGenerationStage(phase: GenerationPhase): ChatGenerationStage {
  if (phase === 'cancel_requested') {
    return 'stopping';
  }
  return phase === 'saving' ? 'running' : phase;
}
