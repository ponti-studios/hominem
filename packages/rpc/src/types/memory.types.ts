export type Memory = {
  id: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoriesListOutput = {
  memories: Memory[];
  /** Cursor for the next page (pass it as `before`), or null on the last page. */
  next: string | null;
  /** The server time the walk began; the same on every page. Sync from this next time (`since`). */
  serverTime: string;
};

export type MemoryStampsOutput = {
  memories: { id: string; updatedAt: string }[];
  serverTime: string;
};

export type MemoryUpdateInput = {
  title?: string | null;
  content?: string;
};

export type MemoryUpdateOutput = Memory;
export type MemoryDeleteOutput = Memory;
