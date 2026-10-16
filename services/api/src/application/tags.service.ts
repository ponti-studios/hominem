import { db, sql } from '@hominem/db/core';
import type * as z from 'zod';

import type { entityTypeSchema } from '../schemas/tags.schema';

export type EntityType = z.output<typeof entityTypeSchema>;

// Only entity types with a live, migrated table go here — it's an allow-list, not a
// passthrough, since entity_table casts straight to a Postgres regclass and can never
// come from unvalidated input. Add more as later migrations bring more domains in.
export const ENTITY_TABLE_MAP: Record<EntityType, string> = {
  people: 'app.people',
  places: 'app.places',
  possessions: 'app.possessions',
  notes: 'app.notes',
  travel_journeys: 'app.travel_journeys',
  travel_journey_segments: 'app.travel_journey_segments',
  travel_transport: 'app.travel_transport',
  travel_stays: 'app.travel_stays',
  travel_airports: 'app.travel_airports',
  travel_places: 'app.travel_places',
  travel_ideas: 'app.travel_ideas',
  residence: 'app.travel_residences',
};

async function ensureOwnedEntity(ownerUserId: string, entityType: EntityType, entityId: string) {
  const entityTable = ENTITY_TABLE_MAP[entityType];
  const result = await sql<{ id: string }>`
    SELECT id FROM ${sql.raw(entityTable)} WHERE id = ${entityId} AND owner_userid = ${ownerUserId}
  `.execute(db);
  if (!result.rows.length) throw new Error('Entity not found');
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'tag';
}

async function findTagByName(ownerUserId: string, name: string) {
  return db
    .selectFrom('app.tags')
    .select(['id', 'name'])
    .where('ownerUserid', '=', ownerUserId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .where('archivedAt', 'is', null)
    .executeTakeFirst();
}

async function findOrCreateTag(ownerUserId: string, tagName: string) {
  const existing = await findTagByName(ownerUserId, tagName);
  if (existing) return existing;

  const slug = slugify(tagName);
  try {
    return await db
      .insertInto('app.tags')
      .values({
        ownerUserid: ownerUserId,
        name: tagName,
        slug,
        path: sql`${slug}::ltree`,
      })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();
  } catch {
    // lost the race to a concurrent insert of the same name — the unique (owner, lower(name))
    // constraint means it's there now, so just go fetch it
    const created = await findTagByName(ownerUserId, tagName);
    if (!created) throw new Error(`Failed to find or create tag "${tagName}"`);
    return created;
  }
}

export async function tagEntity(
  ownerUserId: string,
  input: { entityType: EntityType; entityId: string; tagName: string },
) {
  await ensureOwnedEntity(ownerUserId, input.entityType, input.entityId);
  const tag = await findOrCreateTag(ownerUserId, input.tagName);
  const entityTable = ENTITY_TABLE_MAP[input.entityType];

  await sql`
    INSERT INTO app.tag_assignments (tag_id, entity_table, entity_id, assignment_source)
    VALUES (${tag.id}, ${entityTable}::regclass, ${input.entityId}, 'agent')
    ON CONFLICT (tag_id, entity_table, entity_id) WHERE removed_at IS NULL
    DO NOTHING
  `.execute(db);

  return { tag };
}

export async function untagEntity(
  ownerUserId: string,
  input: { entityType: EntityType; entityId: string; tagId: string },
) {
  await ensureOwnedEntity(ownerUserId, input.entityType, input.entityId);
  const entityTable = ENTITY_TABLE_MAP[input.entityType];

  const result = await sql<{ id: string }>`
    UPDATE app.tag_assignments
    SET removed_at = now()
    WHERE tag_id = ${input.tagId}
      AND entity_table = ${entityTable}::regclass
      AND entity_id = ${input.entityId}
      AND removed_at IS NULL
      AND tag_id IN (SELECT id FROM app.tags WHERE owner_userid = ${ownerUserId})
    RETURNING id
  `.execute(db);

  return { removed: result.rows.length > 0 };
}

export async function listEntityTags(
  ownerUserId: string,
  input: { entityType: EntityType; entityId: string },
) {
  await ensureOwnedEntity(ownerUserId, input.entityType, input.entityId);
  const entityTable = ENTITY_TABLE_MAP[input.entityType];

  const rows = await sql<{ id: string; name: string }>`
    SELECT t.id, t.name
    FROM app.tag_assignments ta
    JOIN app.tags t ON t.id = ta.tag_id
    WHERE ta.entity_table = ${entityTable}::regclass
      AND ta.entity_id = ${input.entityId}
      AND ta.removed_at IS NULL
      AND t.owner_userid = ${ownerUserId}
    ORDER BY t.name
  `.execute(db);

  return { tags: rows.rows, count: rows.rows.length };
}

/** Fetches a tag's name by id, scoped to its owner — used for confirmation previews. */
export async function getTagName(ownerUserId: string, tagId: string): Promise<string | null> {
  const row = await db
    .selectFrom('app.tags')
    .select('name')
    .where('id', '=', tagId)
    .where('ownerUserid', '=', ownerUserId)
    .executeTakeFirst();
  return row?.name ?? null;
}

/**
 * Best-effort display name for a person/place/possession, for confirmation
 * previews — not a general-purpose entity API. People use `displayName`
 * (falling back to first/last name); places and possessions use `name`.
 */
export async function getEntityDisplayName(
  ownerUserId: string,
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  if (entityType === 'people') {
    const row = await db
      .selectFrom('app.people')
      .select(['displayName', 'firstName', 'lastName'])
      .where('id', '=', entityId)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    if (!row) return null;
    if (row.displayName) return row.displayName;
    const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ');
    return fullName || null;
  }

  if (entityType === 'notes') {
    const row = await db
      .selectFrom('app.notes')
      .select('title')
      .where('id', '=', entityId)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row?.title || '(untitled note)';
  }

  if (entityType === 'residence') {
    const result = await sql<{ displayName: string }>`
      SELECT p.place AS "displayName"
      FROM app.travel_residences r
      JOIN app.travel_places p
        ON p.id = r.place_id AND p.owner_userid = r.owner_userid
      WHERE r.id = ${entityId} AND r.owner_userid = ${ownerUserId}
    `.execute(db);
    return result.rows[0]?.displayName ?? null;
  }

  if (entityType.startsWith('travel_')) {
    const displayColumns: Record<EntityType, string> = {
      people: 'display_name',
      places: 'name',
      possessions: 'name',
      notes: 'title',
      travel_journeys: 'name',
      travel_journey_segments: 'legacy_id',
      travel_transport: 'legacy_id',
      travel_stays: 'property',
      travel_airports: 'name',
      travel_places: 'place',
      travel_ideas: 'idea',
      residence: 'place_id',
    };
    const result = await sql<{ displayName: string | null }>`
      SELECT ${sql.raw(displayColumns[entityType])} as "displayName" FROM ${sql.raw(ENTITY_TABLE_MAP[entityType])}
      WHERE id = ${entityId} AND owner_userid = ${ownerUserId}
    `.execute(db);
    if (result.rows.length) {
      const name = result.rows[0]?.displayName;
      if (name) return name;
      if (entityType === 'travel_stays') {
        const city = await sql<{ city: string }>`
          SELECT city FROM app.travel_stays WHERE id = ${entityId} AND owner_userid = ${ownerUserId}
        `.execute(db);
        return city.rows[0]?.city ?? null;
      }
    }
    return null;
  }

  const table = entityType === 'places' ? 'app.places' : 'app.possessions';
  const row = await db
    .selectFrom(table)
    .select('name')
    .where('id', '=', entityId)
    .where('ownerUserid', '=', ownerUserId)
    .executeTakeFirst();
  return row?.name ?? null;
}

export type TagMutationReason = 'invalid_name' | 'target_exists' | 'unknown_tag';

export interface TagMutationResult {
  assignmentsMoved: number;
  tag: { id: string; name: string } | null;
  reason: TagMutationReason | null;
}

export interface TagRenameResult {
  assignmentsPreserved: number;
  tag: { id: string; name: string } | null;
  reason: TagMutationReason | null;
}

async function findOwnedTagByName(ownerUserId: string, name: string) {
  return db
    .selectFrom('app.tags')
    .select(['id', 'name'])
    .where('ownerUserid', '=', ownerUserId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .executeTakeFirst();
}

/**
 * Rename a tag's display name, keeping its id and every assignment. Refuses with
 * `target_exists` when another tag already holds the target name — that is what merge is for.
 */
export async function renameTag(
  ownerUserId: string,
  input: { from: string; to: string },
): Promise<TagRenameResult> {
  const source = await findOwnedTagByName(ownerUserId, input.from);
  if (!source) return { assignmentsPreserved: 0, tag: null, reason: 'unknown_tag' };

  const to = input.to.trim();
  if (!to) return { assignmentsPreserved: 0, tag: null, reason: 'invalid_name' };

  const existing = await findOwnedTagByName(ownerUserId, to);
  if (existing && existing.id !== source.id) {
    return { assignmentsPreserved: 0, tag: null, reason: 'target_exists' };
  }

  const assignments = await db
    .selectFrom('app.tagAssignments')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('tagId', '=', source.id)
    .where('removedAt', 'is', null)
    .executeTakeFirst();

  // Display name only: slug/path are internal identifiers and stay stable, so a rename can
  // never collide with another tag's slug.
  await db
    .updateTable('app.tags')
    .set({ name: to })
    .where('id', '=', source.id)
    .where('ownerUserid', '=', ownerUserId)
    .execute();

  return {
    assignmentsPreserved: Number(assignments?.count ?? 0),
    tag: { id: source.id, name: to },
    reason: null,
  };
}

/**
 * Move every assignment from one tag to another, then remove the emptied tag. Assignments the
 * target already holds are dropped rather than duplicated — the active-assignment unique index
 * is (tag_id, entity_table, entity_id).
 */
export async function mergeTags(
  ownerUserId: string,
  input: { from: string; into: string },
): Promise<TagMutationResult> {
  const source = await findOwnedTagByName(ownerUserId, input.from);
  if (!source) return { assignmentsMoved: 0, tag: null, reason: 'unknown_tag' };

  const target = await findOwnedTagByName(ownerUserId, input.into);
  if (!target) return { assignmentsMoved: 0, tag: null, reason: 'unknown_tag' };

  if (source.id === target.id) {
    return { assignmentsMoved: 0, tag: target, reason: null };
  }

  const moved = await sql<{ id: string }>`
    UPDATE app.tag_assignments ta
    SET tag_id = ${target.id}
    WHERE ta.tag_id = ${source.id}
      AND ta.removed_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM app.tag_assignments other
        WHERE other.tag_id = ${target.id}
          AND other.entity_table = ta.entity_table
          AND other.entity_id = ta.entity_id
          AND other.removed_at IS NULL
      )
    RETURNING ta.id
  `.execute(db);

  // Removes the emptied tag; whatever assignments remain on it (duplicates of the target's, or
  // already-removed rows) go with it via the ON DELETE CASCADE on tag_assignments.tag_id.
  await db
    .deleteFrom('app.tags')
    .where('id', '=', source.id)
    .where('ownerUserid', '=', ownerUserId)
    .execute();

  return { assignmentsMoved: moved.rows.length, tag: target, reason: null };
}
