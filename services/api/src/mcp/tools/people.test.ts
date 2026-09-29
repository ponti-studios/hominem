import { db, pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import './people';
import { callTool, type McpToolResult } from '../tool-registry';

const userId = 'b1000000-0000-4000-8000-000000000001';

const adaId = 'b1000001-0000-4000-8000-000000000001';
const graceId = 'b1000001-0000-4000-8000-000000000002';
const orgId = 'b1000003-0000-4000-8000-000000000001';
const tagId = 'b1000004-0000-4000-8000-000000000001';
const tripId = 'b1000010-0000-4000-8000-000000000001';

type TestPerson = Record<string, unknown>;
type TestResultContent = {
  people?: TestPerson[];
  count?: number;
  person?: TestPerson | null;
  trips?: Array<Record<string, unknown>>;
  relations?: Array<Record<string, unknown>>;
  socialContacts?: Array<Record<string, unknown>>;
};

function resultContent(res: McpToolResult): TestResultContent {
  return res.structuredContent as TestResultContent;
}

beforeAll(async () => {
  // Deleting the user cascades to every app.* row it owns, so each run starts clean.
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [userId, 'Test User', `${userId}@test.hominem.dev`, true],
  );

  await db
    .insertInto('app.people')
    .values([
      {
        id: adaId,
        ownerUserid: userId,
        firstName: 'Ada',
        lastName: 'Lovelace',
        displayName: 'Ada Lovelace',
        personType: 'friend',
        notes: 'mathematician',
      },
      {
        id: graceId,
        ownerUserid: userId,
        firstName: 'Grace',
        lastName: 'Hopper',
        displayName: 'Grace Hopper',
        personType: 'colleague',
        notes: null,
        aliases: JSON.stringify(['Amazing Grace']),
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.personContactMethods')
    .values([
      {
        id: 'b1000005-0000-4000-8000-000000000001',
        ownerUserid: userId,
        personId: adaId,
        kind: 'email',
        value: 'ada@example.com',
        isPrimary: true,
        source: 'manual',
      },
      {
        id: 'b1000005-0000-4000-8000-000000000002',
        ownerUserid: userId,
        personId: adaId,
        kind: 'phone',
        value: '555-0100',
        isPrimary: true,
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.organizations')
    .values([{ id: orgId, ownerUserid: userId, name: 'Analytical Engines Inc' }])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.organizationMemberships')
    .values([
      {
        id: 'b1000006-0000-4000-8000-000000000001',
        ownerUserid: userId,
        organizationId: orgId,
        personId: adaId,
        isPrimary: true,
        source: 'manual',
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.tags')
    .values([
      { id: tagId, ownerUserid: userId, name: 'colleague', path: 'colleague', slug: 'colleague' },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.tagAssignments')
    .values([
      {
        id: 'b1000007-0000-4000-8000-000000000001',
        tagId,
        entityTable: 'app.people',
        entityId: graceId,
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.personRelationships')
    .values([
      {
        id: 'b1000007-0000-4000-8000-000000000002',
        ownerUserid: userId,
        fromPersonId: adaId,
        toPersonId: graceId,
        relationshipType: 'sister',
        startedAt: '2015-01-01',
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.travelTrips')
    .values([
      {
        id: tripId,
        ownerUserid: userId,
        name: 'Denver',
        city: 'Denver',
        country: 'USA',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();

  await db
    .insertInto('app.travelTripAttendees')
    .values([
      {
        id: 'b1000011-0000-4000-8000-000000000001',
        tripId,
        personId: adaId,
        role: 'attendee',
      },
    ])
    .onConflict((oc) => oc.column('id').doNothing())
    .execute();
});

describe('people_lookup', () => {
  it('matches on display name and returns contact/organization details', async () => {
    const result = await callTool(userId, 'people_lookup', { query: 'ada', limit: 10 });
    const data = resultContent(result);

    expect(data.count).toBe(1);
    expect(data.people?.[0]).toMatchObject({
      displayName: 'Ada Lovelace',
      emails: [{ email: 'ada@example.com', isPrimary: true, source: 'manual' }],
      phones: [{ phoneNumber: '555-0100', isPrimary: true }],
      organizations: [{ organization: 'Analytical Engines Inc', isPrimary: true }],
    });
  });

  it('matches on alias', async () => {
    const result = await callTool(userId, 'people_lookup', { query: 'Amazing Grace', limit: 10 });
    const data = resultContent(result);

    expect(data.count).toBe(1);
    expect(data.people?.[0]?.displayName).toBe('Grace Hopper');
  });

  it('includes tag names via the generic tag-assignment join', async () => {
    const result = await callTool(userId, 'people_lookup', { query: 'Grace', limit: 10 });
    const data = resultContent(result);

    expect(data.people?.[0]?.tags).toEqual(['colleague']);
  });

  it('returns no matches for an unrelated query', async () => {
    const result = await callTool(userId, 'people_lookup', { query: 'nonexistent-xyz', limit: 10 });
    expect(resultContent(result).count).toBe(0);
  });
});

describe('person_timeline', () => {
  it('returns the person summary with trips and relations', async () => {
    const result = await callTool(userId, 'person_timeline', { personId: adaId });
    const data = resultContent(result);

    expect(data.person).toMatchObject({ displayName: 'Ada Lovelace', personType: 'friend' });
    expect(data.trips).toEqual([
      {
        id: tripId,
        city: 'Denver',
        state: null,
        country: 'USA',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        role: 'attendee',
      },
    ]);
    expect(data.relations).toEqual([
      {
        relatedPersonId: graceId,
        relatedDisplayName: 'Grace Hopper',
        relation: 'sister',
        startedAt: '2015-01-01 00:00:00+00',
        endedAt: null,
      },
    ]);
    expect(data.socialContacts).toEqual([]);
  });

  it('returns an empty timeline for a person not owned by the caller', async () => {
    const result = await callTool(userId, 'person_timeline', {
      personId: '99999999-9999-4999-8999-999999999999',
    });
    const data = resultContent(result);

    expect(data.person).toBeNull();
    expect(data.trips).toEqual([]);
    expect(data.relations).toEqual([]);
    expect(data.socialContacts).toEqual([]);
  });
});

describe('person_create / person_update', () => {
  const otherUserId = 'b1000000-0000-4000-8000-000000000002';

  beforeAll(async () => {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [otherUserId]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [otherUserId, 'Other User', `${otherUserId}@test.hominem.dev`, true],
    );
  });

  it('creates a person with an email and finds them via people_lookup', async () => {
    const created = resultContent(
      await callTool(userId, 'person_create', {
        displayName: 'Katherine Johnson',
        email: 'katherine@example.com',
      }),
    );
    expect(created.person).toMatchObject({
      displayName: 'Katherine Johnson',
      email: 'katherine@example.com',
    });

    const found = resultContent(await callTool(userId, 'people_lookup', { query: 'Katherine' }));
    expect(found.people).toEqual([
      expect.objectContaining({
        displayName: 'Katherine Johnson',
        emails: [expect.objectContaining({ email: 'katherine@example.com', isPrimary: true })],
      }),
    ]);
  });

  it('updates the name, replaces the email, and clears it with null', async () => {
    const created = resultContent(
      await callTool(userId, 'person_create', {
        displayName: 'Mary Jackson',
        email: 'mary@example.com',
      }),
    ).person as { id: string };

    const renamed = resultContent(
      await callTool(userId, 'person_update', {
        personId: created.id,
        displayName: 'Mary W. Jackson',
        email: 'mary.w@example.com',
      }),
    );
    expect(renamed.person).toMatchObject({
      id: created.id,
      displayName: 'Mary W. Jackson',
      email: 'mary.w@example.com',
    });

    const cleared = resultContent(
      await callTool(userId, 'person_update', { personId: created.id, email: null }),
    );
    expect(cleared.person).toMatchObject({ displayName: 'Mary W. Jackson', email: null });

    const readded = resultContent(
      await callTool(userId, 'person_update', {
        personId: created.id,
        email: 'mary.again@example.com',
      }),
    );
    expect(readded.person).toMatchObject({ email: 'mary.again@example.com' });
  });

  it('rejects an update with nothing to change', async () => {
    await expect(callTool(userId, 'person_update', { personId: adaId })).rejects.toThrow();
  });

  it('promotes the updated email to primary when no contact was marked primary', async () => {
    const created = resultContent(
      await callTool(userId, 'person_create', { displayName: 'Imported Contact' }),
    ).person as { id: string };

    // Simulate an import that left two email contacts with none marked primary.
    await db
      .insertInto('app.personContactMethods')
      .values([
        {
          ownerUserid: userId,
          personId: created.id,
          kind: 'email',
          value: 'old@example.com',
          isPrimary: false,
          source: 'import',
        },
        {
          ownerUserid: userId,
          personId: created.id,
          kind: 'email',
          value: 'older@example.com',
          isPrimary: false,
          source: 'import',
        },
      ])
      .execute();

    await callTool(userId, 'person_update', {
      personId: created.id,
      email: 'old@example.com',
    });

    const lookup = resultContent(
      await callTool(userId, 'people_lookup', { query: 'Imported Contact' }),
    ) as { people: Array<{ id: string; emails: Array<{ email: string; isPrimary: boolean }> }> };
    const person = lookup.people.find((p) => p.id === created.id);
    expect(person?.emails).toEqual(
      expect.arrayContaining([
        { email: 'old@example.com', isPrimary: true, source: 'import' },
        { email: 'older@example.com', isPrimary: false, source: 'import' },
      ]),
    );
    expect(person?.emails.filter((e) => e.isPrimary)).toHaveLength(1);
  });

  it("returns null and changes nothing for another user's person", async () => {
    const result = resultContent(
      await callTool(otherUserId, 'person_update', { personId: adaId, displayName: 'Hijacked' }),
    );
    expect(result.person).toBeNull();

    const row = await db
      .selectFrom('app.people')
      .select('displayName')
      .where('id', '=', adaId)
      .executeTakeFirstOrThrow();
    expect(row.displayName).toBe('Ada Lovelace');
  });

  it('returns null for a person that does not exist', async () => {
    const result = resultContent(
      await callTool(userId, 'person_update', {
        personId: '99999999-9999-4999-8999-999999999999',
        displayName: 'Ghost',
      }),
    );
    expect(result.person).toBeNull();
  });
});

afterAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, ['b1000000-0000-4000-8000-000000000002']);
});
