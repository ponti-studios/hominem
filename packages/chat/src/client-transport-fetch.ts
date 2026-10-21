export type ChatClientTransportRequest = {
  url: string;
  init: RequestInit;
  signal?: AbortSignal;
};

export type ChatClientStreamRequest = ChatClientTransportRequest & {
  onChunk: (chunk: string) => void;
};

export type ChatClientStreamResult = { ok: boolean; status: number; errorMessage?: string };

export type ChatClientTransport = {
  request: (input: ChatClientTransportRequest) => Promise<Response>;
  // Delivers decoded text chunks as they arrive instead of resolving once
  // with a full Response. A Promise<Response> can't model incremental
  // delivery for transports (like XHR on React Native) that only surface
  // a Response after the request fully completes.
  stream: (input: ChatClientStreamRequest) => Promise<ChatClientStreamResult>;
};
