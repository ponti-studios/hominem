// Test transports mock `request` with a Response (often a streamed
// ReadableStream body); this adapts that into the `stream` shape ChatClient
// actually calls for generation SSE, so each test doesn't reimplement it.
export function streamFromRequest(
  request: (input: { url: string; init: RequestInit; signal?: AbortSignal }) => Promise<Response>,
) {
  return async ({
    onChunk,
    ...input
  }: {
    url: string;
    init: RequestInit;
    signal?: AbortSignal;
    onChunk: (chunk: string) => void;
  }): Promise<{ ok: boolean; status: number }> => {
    const response = await request(input);
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text) onChunk(text);
      return { ok: response.ok, status: response.status };
    }
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) onChunk(tail);
    return { ok: response.ok, status: response.status };
  };
}
