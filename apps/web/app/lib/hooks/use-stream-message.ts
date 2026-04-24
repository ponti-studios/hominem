import { useApiClient } from '@hominem/rpc/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { chatQueryKeys } from '~/lib/query-keys';

type StreamStatus = 'idle' | 'streaming' | 'done' | 'error';

export function useStreamMessage({ chatId }: { chatId: string }) {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (input: {
      message: string;
      fileIds?: string[];
      noteIds?: string[];
      onChunk?: (chunk: string) => void;
    }) => {
      setText('');
      setStatus('streaming');
      setError(null);

      abortControllerRef.current = new AbortController();

      try {
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          input.onChunk?.(chunk);
          setText(accumulated);
        }

        // Final flush
        const final = decoder.decode();
        if (final) {
          accumulated += final;
          setText(accumulated);
        }

        setStatus('done');
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.get(chatId) });
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.messages(chatId) });
        await queryClient.invalidateQueries({ queryKey: chatQueryKeys.list });
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          setStatus('idle');
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setStatus('error');
      }
    },
    [chatId, client, queryClient],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
    setText('');
  }, []);

  return {
    stream,
    cancel,
    text,
    status,
    error,
    isStreaming: status === 'streaming',
  };
}
