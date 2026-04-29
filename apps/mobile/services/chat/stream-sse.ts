export interface StreamSSEOptions {
  url: string;
  payload: unknown;
  getHeaders: () => Promise<Record<string, string>>;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

// XHR-based SSE client for React Native / Hermes.
// Hermes does not expose ReadableStream on fetch responses, but XHR.responseText
// grows incrementally as data arrives — we slice from the last offset on each
// readystatechange to extract new SSE lines without re-parsing the full body.
export async function streamSSE({
  url,
  payload,
  getHeaders,
  onChunk,
  signal,
}: StreamSSEOptions): Promise<void> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const authHeaders = await getHeaders();

  return new Promise<void>((resolve, reject) => {
    let offset = 0;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');

    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.onreadystatechange = () => {
      // readyState 3 = LOADING (data arriving), 4 = DONE
      if (xhr.readyState < 3) return;

      const newText = xhr.responseText.slice(offset);
      offset = xhr.responseText.length;

      // Each SSE message is "data: <payload>\n\n"
      for (const line of newText.split('\n')) {
        const trimmed = line.trimEnd();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as { chunk?: string; error?: string };
          if (typeof parsed.error === 'string') {
            cleanup();
            reject(new Error(parsed.error));
            return;
          }
          if (typeof parsed.chunk === 'string') {
            onChunk(parsed.chunk);
          }
        } catch {
          // Partial line or non-JSON comment — skip
        }
      }

      if (xhr.readyState === 4) {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`SSE stream failed: HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('SSE network error'));
    };

    xhr.send(JSON.stringify(payload));
  });
}
