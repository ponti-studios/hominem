export type ChatClientTransportRequest = {
  url: string;
  init: RequestInit;
  signal?: AbortSignal;
};

export type ChatClientStreamRequest = ChatClientTransportRequest & {
  onChunk: (chunk: string) => void;
};

export type ChatClientStreamResult = { ok: boolean; status: number };

export type ChatClientTransport = {
  request: (input: ChatClientTransportRequest) => Promise<Response>;
  // Delivers decoded text chunks as they arrive instead of resolving once
  // with a full Response. A Promise<Response> can't model incremental
  // delivery for transports (like XHR on React Native) that only surface
  // a Response after the request fully completes.
  stream: (input: ChatClientStreamRequest) => Promise<ChatClientStreamResult>;
};

export const fetchChatTransport = (fetchImpl: typeof fetch = fetch): ChatClientTransport => ({
  request: ({ url, init, signal }) => fetchImpl(url, { ...init, signal }),
  stream: async ({ url, init, signal, onChunk }) => {
    const response = await fetchImpl(url, { ...init, signal });
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
  },
});
