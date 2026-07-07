// Chat services stubs — implementations pending

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

// Server exports
export const getUserChatsQuery = async (_userId: string): Promise<unknown[]> => {
  throw new Error('Not implemented');
};
