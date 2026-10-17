import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './tags';
import {
  entityTagsOutputSchema,
  tagEntityOutputSchema,
  untagEntityOutputSchema,
} from '../../schemas/tags.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool } from '../tool-registry';

const userId = 'd1000000-0000-4000-8000-000000000001';

const personId = 'd1000001-0000-4000-8000-000000000001';
const placeId = 'd1000002-0000-4000-8000-000000000001';
const noteId = 'd1000003-0000-4000-8000-000000000001';
const journeyId = 'd1000004-0000-4000-8000-000000000001';
const travelPlaceId = 'd1000005-0000-4000-8000-000000000001';
const residenceId = 'd1000006-0000-4000-8000-000000000001';

beforeAll(async () => {
  // Deleting the user cascades to every app.* row it owns, so each run starts clean.
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [userId, 'Test User', `${userId}@test.hominem.dev`, true],
  );

  await db
    .insertInto('app.people')
    .values([{ id: personId, ownerUserid: userId, displayName: 'Tag Target Person' }])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.places')
    .values([{ id: placeId, ownerUserid: userId, name: 'Tag Target Place', placeType: 'city' }])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.notes')
    .values([
      { id: noteId, ownerUserid: userId, kind: 'note', title: 'Tag Target Note', content: 'body' },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.travelJourneys')
    .values({
      id: journeyId,
      ownerUserid: userId,
      name: 'Tag Test Journey',
      startDate: null,
      endDate: null,
      purpose: null,
      notes: null,
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  await db
    .insertInto('app.places')
    .values({
      id: travelPlaceId,
      ownerUserid: userId,
      name: 'Tag Test City',
      country: 'Testland',
      placeType: 'city',
    })
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
  await pool.query(
    `INSERT INTO app.place_residences (id, owner_userid, place_id)
     VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [residenceId, userId, travelPlaceId],
  );
  await pool.query(
    `INSERT INTO app.place_residence_periods (owner_userid, residence_id, start_date, ongoing, precision)
     VALUES ($1, $2, '2026-01-01', true, 'day')`,
    [userId, residenceId],
  );
});

describe('tag_entity / untag_entity / entity_tags', () => {
  it('creates a new tag and assigns it to a person', async () => {
    const result = await callTool(userId, 'tag_entity', {
      entityType: 'people',
      entityId: personId,
      tagName: 'Close Friend',
    });
    const data = toolOutput(result, tagEntityOutputSchema);

    expect(data.tag?.name).toBe('Close Friend');

    const listed = await callTool(userId, 'entity_tags', {
      entityType: 'people',
      entityId: personId,
    });
    expect(toolOutput(listed, entityTagsOutputSchema).tags).toEqual([
      { id: data.tag?.id, name: 'Close Friend' },
    ]);
  });

  it('tags canonical Places and journeys', async () => {
    const journeyTag = await callTool(userId, 'tag_entity', {
      entityType: 'travel_journeys',
      entityId: journeyId,
      tagName: 'Travel Plan',
    });
    const placeTag = await callTool(userId, 'tag_entity', {
      entityType: 'places',
      entityId: travelPlaceId,
      tagName: 'Travel Place Tag',
    });
    expect(toolOutput(journeyTag, tagEntityOutputSchema).tag?.name).toBe('Travel Plan');
    expect(toolOutput(placeTag, tagEntityOutputSchema).tag?.name).toBe('Travel Place Tag');
    expect(
      toolOutput(
        await callTool(userId, 'entity_tags', {
          entityType: 'travel_journeys',
          entityId: journeyId,
        }),
        entityTagsOutputSchema,
      ).tags,
    ).toHaveLength(1);
    expect(
      toolOutput(
        await callTool(userId, 'entity_tags', {
          entityType: 'places',
          entityId: placeId,
        }),
        entityTagsOutputSchema,
      ).tags,
    ).toHaveLength(0);
  });

  it('tags a Residence through its distinct entity type', async () => {
    const result = await callTool(userId, 'tag_entity', {
      entityType: 'residence',
      entityId: residenceId,
      tagName: 'Current Home',
    });
    expect(toolOutput(result, tagEntityOutputSchema).tag?.name).toBe('Current Home');
    const tags = await callTool(userId, 'entity_tags', {
      entityType: 'residence',
      entityId: residenceId,
    });
    expect(toolOutput(tags, entityTagsOutputSchema).tags).toHaveLength(1);
  });

  it('creates a new tag and assigns it to a note (notes are graph nodes)', async () => {
    const result = await callTool(userId, 'tag_entity', {
      entityType: 'notes',
      entityId: noteId,
      tagName: 'Deep Work',
    });
    expect(toolOutput(result, tagEntityOutputSchema).tag?.name).toBe('Deep Work');

    const listed = await callTool(userId, 'entity_tags', {
      entityType: 'notes',
      entityId: noteId,
    });
    expect(toolOutput(listed, entityTagsOutputSchema).tags).toEqual([
      { id: toolOutput(result, tagEntityOutputSchema).tag?.id, name: 'Deep Work' },
    ]);
  });

  it('reuses an existing tag by name case-insensitively instead of creating a duplicate', async () => {
    const first = await callTool(userId, 'tag_entity', {
      entityType: 'places',
      entityId: placeId,
      tagName: 'favorite',
    });
    const second = await callTool(userId, 'tag_entity', {
      entityType: 'people',
      entityId: personId,
      tagName: 'FAVORITE',
    });

    expect(toolOutput(second, tagEntityOutputSchema).tag?.id).toBe(
      toolOutput(first, tagEntityOutputSchema).tag?.id,
    );
  });

  it('is idempotent — tagging the same entity with the same tag twice does not duplicate', async () => {
    await callTool(userId, 'tag_entity', {
      entityType: 'places',
      entityId: placeId,
      tagName: 'Repeat Tag',
    });
    await callTool(userId, 'tag_entity', {
      entityType: 'places',
      entityId: placeId,
      tagName: 'Repeat Tag',
    });

    const listed = await callTool(userId, 'entity_tags', {
      entityType: 'places',
      entityId: placeId,
    });
    const matches = toolOutput(listed, entityTagsOutputSchema).tags?.filter(
      (t) => t.name === 'Repeat Tag',
    );
    expect(matches).toHaveLength(1);
  });

  it('returns an empty list for an entity with no tags', async () => {
    const untaggedPersonId = 'd1000001-0000-4000-8000-000000000002';
    await db
      .insertInto('app.people')
      .values([{ id: untaggedPersonId, ownerUserid: userId, displayName: 'Untagged Person' }])
      .onConflict((oc) => oc.column('id').doNothing())
      .execute();

    const result = await callTool(userId, 'entity_tags', {
      entityType: 'people',
      entityId: untaggedPersonId,
    });

    expect(toolOutput(result, entityTagsOutputSchema)).toEqual({ tags: [], count: 0 });
  });

  it('removes a tag assignment and reports removed: true', async () => {
    const tagged = await callTool(userId, 'tag_entity', {
      entityType: 'people',
      entityId: personId,
      tagName: 'Removable',
    });
    const taggedTag = toolOutput(tagged, tagEntityOutputSchema).tag;
    if (!taggedTag) throw new Error('tag_entity returned no tag');
    const tagId = taggedTag.id;

    const removed = await callTool(userId, 'untag_entity', {
      entityType: 'people',
      entityId: personId,
      tagId,
    });
    expect(toolOutput(removed, untagEntityOutputSchema)).toEqual({ removed: true });

    const listed = await callTool(userId, 'entity_tags', {
      entityType: 'people',
      entityId: personId,
    });
    expect(toolOutput(listed, entityTagsOutputSchema).tags?.some((t) => t.id === tagId)).toBe(
      false,
    );
  });

  it('reports removed: false when there was nothing to remove', async () => {
    const tagged = await callTool(userId, 'tag_entity', {
      entityType: 'people',
      entityId: personId,
      tagName: 'Untouched',
    });
    const taggedTag = toolOutput(tagged, tagEntityOutputSchema).tag;
    if (!taggedTag) throw new Error('tag_entity returned no tag');
    const tagId = taggedTag.id;

    const result = await callTool(userId, 'untag_entity', {
      entityType: 'places', // wrong entity type — this tag was assigned to a person
      entityId: placeId,
      tagId,
    });
    expect(toolOutput(result, untagEntityOutputSchema)).toEqual({ removed: false });
  });
});
