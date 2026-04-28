export interface ChatRealtimeSendPayload {
  message: string;
  fileIds?: string[];
  noteIds?: string[];
}

export type ChatTransportPreference = 'auto' | 'ws' | 'http-stream';

export type ChatRealtimeClientEvent =
  | {
      type: 'chat.send';
      requestId: string;
      payload: ChatRealtimeSendPayload;
    }
  | {
      type: 'chat.cancel';
      requestId: string;
    }
  | {
      type: 'chat.ping';
      requestId: string;
    };

export type ChatRealtimeServerEvent =
  | {
      type: 'chat.ack';
      requestId: string;
    }
  | {
      type: 'chat.status';
      requestId: string;
      status: 'submitted' | 'streaming' | 'done';
    }
  | {
      type: 'chat.chunk';
      requestId: string;
      chunk: string;
    }
  | {
      type: 'chat.final';
      requestId: string;
      assistantText: string;
    }
  | {
      type: 'chat.error';
      requestId: string;
      message: string;
      code?: string;
    };
