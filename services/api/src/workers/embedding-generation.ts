import { generateEmbedding } from '@hominem/ai';
import { ChatRepository, NoteRepository, VectorDocumentRepository, db } from '@hominem/db';
import { QUEUE_NAMES, type EmbeddingGenerationJob } from '@hominem/queues';
import { redis as cache } from '@hominem/services/redis';
import { logger } from '@hominem/telemetry';
import { Worker } from 'bullmq';

import { recordAIUsageEvent } from '../application/ai-usage.service';

const EMBEDDING_DIMENSIONS = 1536;

let worker: Worker | null = null;

async function buildEntityContent(
  entityType: EmbeddingGenerationJob['entityType'],
  entityId: string,
  userId: string,
): Promise<string | null> {
  if (entityType === 'note') {
    const note = await NoteRepository.load(db, entityId, userId);
    return [note.title, note.content].filter((part) => part && part.trim().length > 0).join('\n\n');
  }

  const messages = await ChatRepository.getMessages(db, entityId, 200, 0);
  if (messages.length === 0) {
    return null;
  }

  return messages.map((message) => `${message.role}: ${message.content}`).join('\n\n');
}

async function processEmbeddingJob(data: EmbeddingGenerationJob) {
  const content = await buildEntityContent(data.entityType, data.entityId, data.userId);
  if (!content || content.trim().length === 0) {
    return;
  }

  const embeddingResult = await generateEmbedding(content, { dimensions: EMBEDDING_DIMENSIONS });
  const embedding = embeddingResult.embedding;
  if (embedding.length === 0) {
    logger.error('[embeddings] generation returned empty vector', {
      entityType: data.entityType,
      entityId: data.entityId,
    });
    return;
  }

  await recordAIUsageEvent({
    userId: data.userId,
    feature: 'embedding',
    operation: 'embedding',
    usage: embeddingResult.usage,
    metadata: {
      entityType: data.entityType,
      entityId: data.entityId,
    },
  });

  await VectorDocumentRepository.upsert(db, {
    ownerUserId: data.userId,
    entityType: data.entityType,
    entityId: data.entityId,
    content,
    embedding,
  });
}

export function startEmbeddingGenerationWorker() {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    QUEUE_NAMES.EMBEDDING_GENERATION,
    async (job) => processEmbeddingJob(job.data as EmbeddingGenerationJob),
    { connection: cache },
  );

  worker.on('failed', (job, error) => {
    logger.error('[embeddings] generation job failed', {
      jobId: job?.id,
      error,
    });
  });

  return worker;
}
