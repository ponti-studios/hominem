import { sql } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';

export interface PossessionImageRecord {
  id: string;
  possessionId: string;
  fileId: string;
  displayOrder: number;
  altText: string | null;
  originalFilename: string | null;
  // Stored (unsigned) object URL and type of the backing file; the API signs the URL before it
  // reaches a client.
  fileUrl: string;
  mimetype: string;
  createdAt: string;
}

export interface AttachPossessionImageInput {
  userId: string;
  possessionId: string;
  fileId: string;
  altText?: string | null;
}

// Images always come with their ready file; a row whose file is gone or not ready is invisible.
const imageQuery = (handle: DbHandle, userId: string) =>
  handle
    .selectFrom('app.possessionImages as pi')
    .innerJoin('app.files as f', 'f.id', 'pi.fileId')
    .where('pi.ownerUserid', '=', userId)
    .where('f.status', '=', 'ready')
    .select([
      'pi.id as id',
      'pi.possessionId as possessionId',
      'pi.fileId as fileId',
      'pi.displayOrder as displayOrder',
      'pi.altText as altText',
      'pi.originalFilename as originalFilename',
      'pi.createdat as createdAt',
      'f.url as fileUrl',
      'f.mimetype as mimetype',
    ]);

type ImageRow = Awaited<ReturnType<ReturnType<typeof imageQuery>['execute']>>[number];

function toImage(row: ImageRow): PossessionImageRecord {
  // The inner join on app.files guarantees a file, but the column itself is nullable.
  if (row.fileId === null) throw new Error(`possession image ${row.id} has no file`);
  return {
    id: row.id,
    possessionId: row.possessionId,
    fileId: row.fileId,
    displayOrder: row.displayOrder,
    altText: row.altText,
    originalFilename: row.originalFilename,
    fileUrl: row.fileUrl,
    mimetype: row.mimetype,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

// Photos change what a client sees of a possession, so touching the row puts it back into the
// `since` delta that sync clients pull.
async function touchPossession(handle: DbHandle, userId: string, possessionId: string) {
  await handle
    .updateTable('app.possessions')
    .set({ updatedat: sql`now()` })
    .where('id', '=', possessionId)
    .where('ownerUserid', '=', userId)
    .execute();
}

export const PossessionImageRepository = {
  // Photos of the given possessions, in display order. Owner-scoped.
  async listByPossessionIds(
    handle: DbHandle,
    userId: string,
    possessionIds: string[],
  ): Promise<PossessionImageRecord[]> {
    if (possessionIds.length === 0) return [];
    const rows = await imageQuery(handle, userId)
      .where('pi.possessionId', 'in', possessionIds)
      .orderBy('pi.possessionId')
      .orderBy('pi.displayOrder')
      .execute();
    return rows.map(toImage);
  },

  // Appends after the last photo. Attaching the same file to the same possession twice returns
  // the existing row, so a retried client request never duplicates. The caller has already
  // verified the possession and the (ready) file belong to the user.
  async attach(
    handle: DbHandle,
    input: AttachPossessionImageInput,
  ): Promise<{ image: PossessionImageRecord; created: boolean }> {
    const existing = await imageQuery(handle, input.userId)
      .where('pi.fileId', '=', input.fileId)
      .where('pi.possessionId', '=', input.possessionId)
      .executeTakeFirst();
    if (existing) return { image: toImage(existing), created: false };

    const file = await handle
      .selectFrom('app.files')
      .select(['storageKey', 'originalName'])
      .where('id', '=', input.fileId)
      .where('ownerUserid', '=', input.userId)
      .executeTakeFirstOrThrow();
    const inserted = await handle
      .insertInto('app.possessionImages')
      .values({
        ownerUserid: input.userId,
        possessionId: input.possessionId,
        fileId: input.fileId,
        path: file.storageKey,
        originalFilename: file.originalName,
        altText: input.altText ?? null,
        displayOrder: sql<number>`(
          SELECT COALESCE(MAX(display_order) + 1, 0)
          FROM app.possession_images
          WHERE possession_id = ${input.possessionId}
        )`,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    await touchPossession(handle, input.userId, input.possessionId);
    const row = await imageQuery(handle, input.userId)
      .where('pi.id', '=', inserted.id)
      .executeTakeFirstOrThrow();
    return { image: toImage(row), created: true };
  },

  // Returns the removed image's file id so the caller can log it.
  async remove(
    handle: DbHandle,
    userId: string,
    possessionId: string,
    imageId: string,
  ): Promise<{ fileId: string | null }> {
    const row = await handle
      .deleteFrom('app.possessionImages')
      .where('id', '=', imageId)
      .where('possessionId', '=', possessionId)
      .where('ownerUserid', '=', userId)
      .returning('fileId')
      .executeTakeFirst();
    if (!row) throw new NotFoundError('PossessionImage');
    await touchPossession(handle, userId, possessionId);
    return { fileId: row.fileId };
  },

  // Rewrites display_order to match `orderedIds` (every image of the possession, once each).
  // Two passes through negative numbers so the (possession_id, display_order) unique key never
  // collides mid-update.
  async reorder(
    handle: DbHandle,
    userId: string,
    possessionId: string,
    orderedIds: string[],
  ): Promise<void> {
    const current = await handle
      .selectFrom('app.possessionImages')
      .select('id')
      .where('possessionId', '=', possessionId)
      .where('ownerUserid', '=', userId)
      .execute();
    const have = new Set(current.map((r) => r.id));
    if (
      orderedIds.length !== have.size ||
      new Set(orderedIds).size !== orderedIds.length ||
      !orderedIds.every((id) => have.has(id))
    ) {
      throw new NotFoundError('PossessionImage');
    }
    for (const [index, id] of orderedIds.entries()) {
      await handle
        .updateTable('app.possessionImages')
        .set({ displayOrder: -(index + 1) })
        .where('id', '=', id)
        .execute();
    }
    for (const [index, id] of orderedIds.entries()) {
      await handle
        .updateTable('app.possessionImages')
        .set({ displayOrder: index })
        .where('id', '=', id)
        .execute();
    }
    await touchPossession(handle, userId, possessionId);
  },
};
