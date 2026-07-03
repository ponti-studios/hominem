import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppVectorDocuments } from '../../types/database';

type VectorDocumentRow = Selectable<AppVectorDocuments>;

export type VectorDocumentEntityType = 'note' | 'chat';

export interface VectorDocumentRecord {
  id: string;
  ownerUserId: string;
  entityType: VectorDocumentEntityType;
  entityId: string;
  content: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertVectorDocumentInput {
  ownerUserId: string;
  entityType: VectorDocumentEntityType;
  entityId: string;
  content: string;
  embedding: number[];
  metadata?: unknown;
}

export interface SearchVectorDocumentsInput {
  userId: string;
  embedding: number[];
  entityType?: VectorDocumentEntityType;
  limit?: number;
  threshold?: number;
}

export interface VectorDocumentSearchResult extends VectorDocumentRecord {
  similarity: number;
}

function toVectorDocumentRecord(row: VectorDocumentRow): VectorDocumentRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_userid,
    entityType: row.entity_type as VectorDocumentEntityType,
    entityId: row.entity_id,
    content: row.content,
    metadata: row.metadata,
    createdAt: new Date(row.createdat).toISOString(),
    updatedAt: new Date(row.updatedat).toISOString(),
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export const VectorDocumentRepository = {
  async upsert(handle: DbHandle, input: UpsertVectorDocumentInput): Promise<VectorDocumentRecord> {
    const vectorLiteral = toVectorLiteral(input.embedding);
    const metadata = input.metadata === undefined ? null : (input.metadata as never);

    const row = await handle
      .insertInto('app.vector_documents')
      .values({
        owner_userid: input.ownerUserId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        content: input.content,
        embedding: sql`${vectorLiteral}::vector`,
        metadata,
      })
      .onConflict((oc) =>
        oc.columns(['entity_type', 'entity_id']).doUpdateSet({
          content: input.content,
          embedding: sql`${vectorLiteral}::vector`,
          metadata,
          updatedat: new Date(),
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    return toVectorDocumentRecord(row as VectorDocumentRow);
  },

  async deleteForEntity(
    handle: DbHandle,
    entityType: VectorDocumentEntityType,
    entityId: string,
  ): Promise<void> {
    await handle
      .deleteFrom('app.vector_documents')
      .where('entity_type', '=', entityType)
      .where('entity_id', '=', entityId)
      .execute();
  },

  /**
   * Cosine similarity search, ordered by ascending distance (not descending
   * similarity) so the HNSW index can be used.
   */
  async search(
    handle: DbHandle,
    input: SearchVectorDocumentsInput,
  ): Promise<VectorDocumentSearchResult[]> {
    const vectorLiteral = toVectorLiteral(input.embedding);
    const limit = input.limit ?? 10;

    let query = handle
      .selectFrom('app.vector_documents')
      .selectAll()
      .select(sql<number>`1 - (embedding <=> ${vectorLiteral}::vector)`.as('similarity'))
      .where('owner_userid', '=', input.userId);

    if (input.entityType) {
      query = query.where('entity_type', '=', input.entityType);
    }

    if (input.threshold !== undefined) {
      query = query.where(
        sql<boolean>`1 - (embedding <=> ${vectorLiteral}::vector) >= ${input.threshold}`,
      );
    }

    const rows = await query
      .orderBy(sql`embedding <=> ${vectorLiteral}::vector`)
      .limit(limit)
      .execute();

    return rows.map((row) => ({
      ...toVectorDocumentRecord(row as VectorDocumentRow),
      similarity: (row as VectorDocumentRow & { similarity: number }).similarity,
    }));
  },
};
