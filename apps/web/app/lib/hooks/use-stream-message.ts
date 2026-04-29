import { streamChatWithWsFirst, toWebSocketUrl } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import type { ChatTransportPreference } from '@hominem/rpc/types';
import { useSignal } from '@preact/signals-react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { chatQueryKeys } from '~/lib/query-keys';

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export function useStreamMessage({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const text = useSignal('');
  const status = useSignal<StreamStatus>('idle');
  const error = useSignal<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transportPreference = (import.meta.env['VITE_CHAT_TRANSPORT'] ||
    'auto') as ChatTransportPreference;

  const stream = useCallback(
    async (input: {
      message: string;
      fileIds?: string[];
      noteIds?: string[];
      onChunk?: (chunk: string) => void;
    }) => {
      text.value = '';
      status.value = 'streaming';
      error.value = null;

      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;

      try {
        await streamChatWithWsFirst({
          wsUrl: toWebSocketUrl(
            import.meta.env.VITE_PUBLIC_API_URL as string,
            `/api/chats/${chatId}/ws`,
          ),
          transportPreference,
          payload: {
            message: input.message,
            ...(input.fileIds && input.fileIds.length > 0 ? { fileIds: input.fileIds } : {}),
            ...(input.noteIds && input.noteIds.length > 0 ? { noteIds: input.noteIds } : {}),
          },
          signal: abortSignal,
          onChunk: (chunk) => {
            input.onChunk?.(chunk);
            text.value += chunk;
          },
          onStatus: (nextStatus) => {
            if (nextStatus === 'submitted' || nextStatus === 'streaming') {
              status.value = 'streaming';
              return;
            }
            if (nextStatus === 'done') {
              status.value = 'done';
            }
          },
          fallback: async () => {
            const streamRes = await client.api.chats[':id'].stream.$post({
              param: { id: chatId },
              json: {
                message: input.message,
                ...(input.fileIds && input.fileIds.length > 0 ? { fileIds: input.fileIds } : {}),
                ...(input.noteIds && input.noteIds.length > 0 ? { noteIds: input.noteIds } : {}),
              },
            });
            const body = streamRes.body;
            if (!body) throw new Error('No response body');

            const reader = body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';
            let lineBuffer = '';

            const processLine = (line: string) => {
              if (!line.startsWith('data: ')) return;
              const data = line.slice(6).trimEnd();
              if (data === '[DONE]') return;
              try {
                const parsed = JSON.parse(data) as { chunk?: string; error?: string };
                if (parsed.error) throw new Error(parsed.error);
                if (typeof parsed.chunk === 'string') {
                  accumulated += parsed.chunk;
                  input.onChunk?.(parsed.chunk);
                  text.value = accumulated;
                }
              } catch (e) {
                if (e instanceof Error && e.message !== data) throw e;
              }
            };

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              lineBuffer += decoder.decode(value, { stream: true });
              const lines = lineBuffer.split('\n');
              lineBuffer = lines.pop() ?? '';
              for (const line of lines) processLine(line);
            }

            const final = decoder.decode();
            if (final) lineBuffer += final;
            for (const line of lineBuffer.split('\n')) processLine(line);

            return { assistantText: accumulated };
          },
        });

        status.value = 'done';
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.get(chatId) });
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(chatId) });
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          status.value = 'idle';
          return;
        }
        const nextError = err instanceof Error ? err : new Error(String(err));
        error.value = nextError;
        status.value = 'error';
      }
    },
    [chatId, client, error, queryClient, status, text, transportPreference],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    status.value = 'idle';
    text.value = '';
  }, [status, text]);

  return {
    stream,
    cancel,
    text: text.value,
    status: status.value,
    error: error.value,
    isStreaming: status.value === 'streaming',
  };
}
