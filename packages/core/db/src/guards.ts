export interface ChatMessageFileRecord {
  type: 'image' | 'file';
  fileId?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  metadata?: Record<string, unknown>;
}

export interface ChatMessageToolCallRecord {
  toolName: string;
  type: 'tool-call';
  toolCallId: string;
  args: Record<string, string>;
}

export function isChatMessageFileRecord(value: unknown): value is ChatMessageFileRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.type !== 'image' && record.type !== 'file') return false;
  if (record.fileId !== undefined && typeof record.fileId !== 'string') return false;
  if (record.url !== undefined && typeof record.url !== 'string') return false;
  if (record.filename !== undefined && typeof record.filename !== 'string') return false;
  if (record.mimeType !== undefined && typeof record.mimeType !== 'string') return false;
  if (record.size !== undefined && typeof record.size !== 'number') return false;
  if (
    record.metadata !== undefined &&
    (typeof record.metadata !== 'object' || record.metadata === null)
  )
    return false;
  return true;
}

export function isChatMessageToolCallRecord(value: unknown): value is ChatMessageToolCallRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.toolName !== 'string') return false;
  if (record.type !== 'tool-call') return false;
  if (typeof record.toolCallId !== 'string') return false;
  if (typeof record.args !== 'object' || record.args === null) return false;
  const args = record.args as Record<string, unknown>;
  for (const key of Object.keys(args)) {
    if (typeof args[key] !== 'string') return false;
  }
  return true;
}

export function parseChatMessageFiles(value: unknown): ChatMessageFileRecord[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => {
    if (!isChatMessageFileRecord(item)) return null;
    return item;
  });
  if (parsed.some((item) => item === null)) return null;
  return parsed as ChatMessageFileRecord[];
}

export function parseChatMessageToolCalls(value: unknown): ChatMessageToolCallRecord[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => {
    if (!isChatMessageToolCallRecord(item)) return null;
    return item;
  });
  if (parsed.some((item) => item === null)) return null;
  return parsed as ChatMessageToolCallRecord[];
}
