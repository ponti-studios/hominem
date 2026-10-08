import { db } from '@hominem/db/core';
import { NoteRepository } from '@hominem/db/notes';
import { embeddingQueue } from '@hominem/queues';

// Memories are just notes with kind = 'memory'. The MCP `remember` tool and POST /api/memory
// are thin adapters over this one operation.

interface RememberInput {
  content: string;
  title?: string | undefined;
}

export async function rememberMemory(userId: string, input: RememberInput) {
  const result = await NoteRepository.createMemoryIfAbsent(db, {
    userId,
    title: input.title ?? null,
    content: input.content,
    excerpt: input.content.slice(0, 200),
  });

  // Enqueue on every call, not only on create: the jobId makes it idempotent, and a retry after a
  // failed enqueue (the row is already saved) repairs the missing embedding instead of skipping it.
  const jobId = `note-${result.record.id}`;
  await embeddingQueue.add(
    'generate-embedding',
    { jobId, userId, entityType: 'note' as const, entityId: result.record.id },
    { jobId, removeOnComplete: true, removeOnFail: false },
  );

  return result;
}
