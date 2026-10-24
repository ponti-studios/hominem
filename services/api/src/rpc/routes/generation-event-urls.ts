import type { GenerationEvent } from '@hominem/chat';

import { signMessageFiles } from './chats.mapper';

// Events are stored with permanent attachment URLs (replay needs them stable), but anything that
// goes out over the wire gets short-lived signed ones, same as the REST message DTOs.
async function signEvent(event: GenerationEvent): Promise<GenerationEvent> {
  switch (event.type) {
    case 'generation.accepted': {
      const { userMessage } = event.payload;
      if (!userMessage) return event;
      return {
        ...event,
        payload: { ...event.payload, userMessage: await signMessageFiles(userMessage) },
      };
    }
    case 'generation.checkpointed': {
      const { checkpoint } = event.payload;
      return {
        ...event,
        payload: {
          ...event.payload,
          checkpoint: {
            ...checkpoint,
            assistantMessage: await signMessageFiles(checkpoint.assistantMessage),
          },
        },
      };
    }
    case 'generation.committed': {
      const { message, metadata } = event.payload;
      return {
        ...event,
        payload: {
          ...event.payload,
          message: await signMessageFiles(message),
          ...(metadata?.assistantMessage
            ? {
                metadata: {
                  ...metadata,
                  assistantMessage: await signMessageFiles(metadata.assistantMessage),
                },
              }
            : {}),
        },
      };
    }
    case 'generation.cancelled': {
      const { metadata } = event.payload;
      if (!metadata?.assistantMessage) return event;
      return {
        ...event,
        payload: {
          ...event.payload,
          metadata: {
            ...metadata,
            assistantMessage: await signMessageFiles(metadata.assistantMessage),
          },
        },
      };
    }
    case 'generation.failed': {
      const { metadata } = event.payload;
      if (!metadata?.assistantMessage) return event;
      return {
        ...event,
        payload: {
          ...event.payload,
          metadata: {
            ...metadata,
            assistantMessage: await signMessageFiles(metadata.assistantMessage),
          },
        },
      };
    }
    default:
      return event;
  }
}

export async function* signGenerationEvents(
  events: AsyncIterable<GenerationEvent>,
): AsyncGenerator<GenerationEvent> {
  for await (const event of events) {
    yield await signEvent(event);
  }
}
