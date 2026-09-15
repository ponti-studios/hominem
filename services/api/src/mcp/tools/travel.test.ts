import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './travel';
import { callTool, type McpToolResult } from '../tool-registry';

const ownerId = 'e1000000-0000-4000-8000-000000000001';
const otherUserId = 'e1000000-0000-4000-8000-000000000002';
const tripId = 'e1000010-0000-4000-8000-000000000001';
const ownerPersonId = 'e1000001-0000-4000-8000-000000000001';
const otherPersonId = 'e1000001-0000-4000-8000-000000000002';

function content(result: McpToolResult) {
  return result.structuredContent as {
    trips?: Array<{
      attendeeNames: string[];
      city: string | null;
      country: string | null;
      endDate: string | null;
      id: string;
      startDate: string | null;
      state: string | null;
    }>;
    count?: number;
  };
}

beforeAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id IN ($1, $2)`, [ownerId, otherUserId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
    [
      ownerId,
      'Travel Owner',
      `${ownerId}@test.hominem.dev`,
      true,
      otherUserId,
      'Other User',
      `${otherUserId}@test.hominem.dev`,
      true,
    ],
  );
  await db
    .insertInto('app.people')
    .values([
      { id: ownerPersonId, ownerUserid: ownerId, displayName: 'Visible Guest' },
      { id: otherPersonId, ownerUserid: otherUserId, displayName: 'Hidden Guest' },
    ])
    .execute();
  await db
    .insertInto('app.travelTrips')
    .values({
      id: tripId,
      ownerUserid: ownerId,
      name: 'Research trip',
      city: 'Boston',
      country: 'USA',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
    })
    .execute();
  await db
    .insertInto('app.travelTripAttendees')
    .values([
      {
        id: 'e1000011-0000-4000-8000-000000000001',
        tripId,
        personId: ownerPersonId,
        role: 'attendee',
      },
      {
        id: 'e1000011-0000-4000-8000-000000000002',
        tripId,
        personId: otherPersonId,
        role: 'attendee',
      },
    ])
    .execute();
});

describe('trip_history', () => {
  it('returns owner trips, date filters, limits, and owner-scoped attendee names', async () => {
    const result = await callTool(ownerId, 'trip_history', {
      from: '2026-10-01',
      limit: 1,
      to: '2026-10-31',
    });
    expect(content(result)).toEqual({
      count: 1,
      trips: [
        {
          attendeeNames: ['Visible Guest'],
          city: 'Boston',
          country: 'USA',
          endDate: '2026-10-12',
          id: tripId,
          startDate: '2026-10-10',
          state: null,
        },
      ],
    });
  });

  it('rejects impossible ISO dates before reaching the database', async () => {
    await expect(
      callTool(ownerId, 'trip_history', { from: '2026-02-31', limit: 20 }),
    ).rejects.toThrow('Expected a valid calendar date.');
  });
});
