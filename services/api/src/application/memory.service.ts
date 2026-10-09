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

const MEMORY_KIND = 'memory' as const;

interface ListInput {
  limit?: number | undefined;
  before?: string | undefined;
  since?: string | undefined;
}

/** One page of a person's memories, newest first, for an app that keeps its own copy. */
export async function listMemoriesPage(userId: string, input: ListInput) {
  const page = await NoteRepository.listPage(db, {
    userId,
    kind: MEMORY_KIND,
    limit: input.limit ?? 50,
    before: input.before,
    since: input.since,
  });
  return { memories: page.notes, next: page.next, serverTime: page.asOf };
}

/** Every memory id with its update time, so an app can drop the copies deleted elsewhere. */
export async function listMemoryStamps(userId: string) {
  // Read the clock first: anything that changes after it is found by the next `since`.
  const serverTime = await NoteRepository.databaseTime(db);
  const memories = await NoteRepository.listStamps(db, { userId, kind: MEMORY_KIND });
  return { memories, serverTime };
}
