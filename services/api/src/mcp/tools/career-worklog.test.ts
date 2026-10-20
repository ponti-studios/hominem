import { convertSchemaToJsonSchema } from '@hominem/ai';
import { WorklogRepository } from '@hominem/db/career';
import { db, pool, sql } from '@hominem/db/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import './career';
import './career-worklog';
import {
  careerWorklogCreateOutputSchema,
  careerWorklogEntriesSchema,
  careerWorklogEntryDetailSchema,
  careerWorklogUpdateOutputSchema,
} from '../../schemas/career.schema';
import { removedResultSchema } from '../../schemas/common.schema';
import { toolOutput } from '../../testkit/tool-result';
import { describeCapability } from '../tool-planner';
import { callTool, getToolDefinition, listTools, listToolsForScopes } from '../tool-registry';

const userId = 'a3500001-0000-4000-8000-000000000001';
const otherUserId = 'a3500001-0000-4000-8000-000000000002';

const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [id, `Career Worklog Test User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
});

async function createEngagement(owner: string, company: string) {
  const engagement = await db
    .insertInto('app.careerEngagements')
    .values({ ownerUserid: owner, company, title: 'Engineer' })
    .returning('id')
    .executeTakeFirstOrThrow();
  return engagement.id;
}

async function createProject(owner: string, title: string) {
  const project = await db
    .insertInto('app.careerProjects')
    .values({ ownerUserid: owner, title })
    .returning('id')
    .executeTakeFirstOrThrow();
  return project.id;
}

describe('career_worklog_create', () => {
  it('captures an entry from only the engagement and the raw note', async () => {
    const engagementId = await createEngagement(userId, 'Capture Floor Co');
    const rawNote = '  Offline sync kept dropping queued chat messages  ';

    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote }),
      careerWorklogCreateOutputSchema,
    );

    expect(created.entry).toMatchObject({
      engagementId,
      projectId: null,
      impactStatus: 'open',
      sensitivity: 'internal',
      tags: [],
      evidence: [],
      area: null,
      problem: null,
      action: null,
      impact: null,
      publicBullet: null,
      knownLimits: null,
      occurredStart: today(),
      occurredEnd: null,
    });
    // The raw note is the user's words: stored verbatim, whitespace and all.
    expect(created.entry.rawNote).toBe(rawNote);
    expect(created.entry.loggedAt).toEqual(expect.any(String));
    expect(created.entry.updatedAt).toEqual(expect.any(String));

    const stored = await db
      .selectFrom('app.careerWorklogEntries')
      .select(['rawNote', 'loggedAt'])
      .where('id', '=', created.entry.id)
      .executeTakeFirstOrThrow();
    expect(stored.rawNote).toBe(rawNote);
    expect(stored.loggedAt).toEqual(expect.any(String));

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('keeps every provided field', async () => {
    const engagementId = await createEngagement(userId, 'Full Co');
    const projectId = await createProject(userId, 'Ledger Prototype');

    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Migrated the mobile webview from JWTs to one-time tokens.',
        projectId,
        occurredStart: '2026-03-02',
        occurredEnd: '2026-03-09',
        area: 'mobile auth',
        problem: 'Long-lived JWTs were replayable from a stolen device.',
        action: 'Issued one-time tokens backed by the session store.',
        impact: 'Replay window dropped from 30 days to 60 seconds.',
        impactStatus: 'closed',
        tags: ['security', 'mobile'],
        sensitivity: 'mixed',
        publicBullet: 'Replaced replayable JWTs with one-time tokens.',
        knownLimits: 'Needs device binding to close the last gap.',
        evidence: [{ kind: 'pr', label: 'PR 42', url: 'https://example.com/pr/42' }],
      }),
      careerWorklogCreateOutputSchema,
    );

    expect(created.entry).toMatchObject({
      engagementId,
      projectId,
      occurredStart: '2026-03-02',
      occurredEnd: '2026-03-09',
      area: 'mobile auth',
      problem: 'Long-lived JWTs were replayable from a stolen device.',
      action: 'Issued one-time tokens backed by the session store.',
      impact: 'Replay window dropped from 30 days to 60 seconds.',
      impactStatus: 'closed',
      tags: ['security', 'mobile'],
      sensitivity: 'mixed',
      publicBullet: 'Replaced replayable JWTs with one-time tokens.',
      knownLimits: 'Needs device binding to close the last gap.',
    });
    expect(created.entry.evidence).toEqual([
      { kind: 'pr', label: 'PR 42', url: 'https://example.com/pr/42' },
    ]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('defaults an evidence ref without a url to null', async () => {
    const engagementId = await createEngagement(userId, 'Evidence Co');

    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Private tracker ticket, no link.',
        evidence: [{ kind: 'ticket', label: 'ENG-123' }],
      }),
      careerWorklogCreateOutputSchema,
    );

    expect(created.entry.evidence).toEqual([{ kind: 'ticket', label: 'ENG-123', url: null }]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('fails as not found for another owner’s engagement', async () => {
    const engagementId = await createEngagement(otherUserId, 'Private Co');

    await expect(
      callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Not mine.' }),
    ).rejects.toThrow('Career engagement not found');
  });

  it('fails as not found for a nonexistent engagement', async () => {
    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId: 'a3500001-0000-4000-8000-0000000000ff',
        rawNote: 'No such engagement.',
      }),
    ).rejects.toThrow('Career engagement not found');
  });

  it('fails as not found for another owner’s project', async () => {
    const engagementId = await createEngagement(userId, 'Project Scope Co');
    const projectId = await createProject(otherUserId, 'Private Project');

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Borrowed project.',
        projectId,
      }),
    ).rejects.toThrow('Career project not found');
  });

  it('fails as not found for a nonexistent project', async () => {
    const engagementId = await createEngagement(userId, 'Missing Project Co');

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'No such project.',
        projectId: 'a3500001-0000-4000-8000-0000000000fe',
      }),
    ).rejects.toThrow('Career project not found');
  });

  it('never accepts the server-owned fields from a client', async () => {
    const engagementId = await createEngagement(userId, 'Server Owned Co');

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Client-set capture time.',
        loggedAt: '2020-01-01T00:00:00Z',
      }),
    ).rejects.toThrow(/loggedAt/);

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Client-set id.',
        id: 'a3500001-0000-4000-8000-0000000000fd',
      }),
    ).rejects.toThrow(/id/);
  });

  it('rejects an end date before the start date', async () => {
    const engagementId = await createEngagement(userId, 'Window Co');

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Backwards window.',
        occurredStart: '2026-04-10',
        occurredEnd: '2026-04-01',
      }),
    ).rejects.toThrow('occurredEnd must be on or after occurredStart.');
  });

  it('rejects an end date before the defaulted start date', async () => {
    const engagementId = await createEngagement(userId, 'Default Window Co');

    await expect(
      callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Ends before it started.',
        occurredEnd: '2020-01-01',
      }),
    ).rejects.toThrow('occurredEnd must be on or after occurredStart.');
  });
});

describe('career_worklog_update', () => {
  // Every mutable field, with the value the update sets it to. `engagementId` and
  // `projectId` need ids resolved at runtime, so they have their own cases below.
  const mutableFieldCases: Array<[string, Record<string, unknown>]> = [
    ['occurredStart', { occurredStart: '2026-05-01' }],
    ['occurredEnd', { occurredEnd: '2026-05-03' }],
    ['area', { area: 'billing' }],
    ['problem', { problem: 'Invoices were double-charged.' }],
    ['action', { action: 'Made the charge idempotent.' }],
    ['impact', { impact: 'Zero duplicate charges in 30 days.' }],
    ['impactStatus', { impactStatus: 'closed' }],
    ['tags', { tags: ['billing', 'correctness'] }],
    ['sensitivity', { sensitivity: 'public_safe' }],
    ['publicBullet', { publicBullet: 'Made invoicing idempotent.' }],
    ['knownLimits', { knownLimits: 'Only covers card charges.' }],
    [
      'evidence',
      {
        evidence: [
          { kind: 'ticket', label: 'ENG-9', url: null },
          { kind: 'pr', label: 'PR 12', url: 'https://example.com/pr/12' },
        ],
      },
    ],
  ];

  it.each(mutableFieldCases)('updates %s', async (field, data) => {
    const engagementId = await createEngagement(userId, `Field ${field} Co`);
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Field capture.',
        // Early enough that any occurredEnd value in the cases above is a legal window.
        occurredStart: '2020-01-01',
      }),
      careerWorklogCreateOutputSchema,
    );

    const updated = toolOutput(
      await callTool(userId, 'career_worklog_update', { id: created.entry.id, data }),
      careerWorklogUpdateOutputSchema,
    );

    expect(updated.entry).toMatchObject({ id: created.entry.id, ...data });
    // The immutable capture is untouched by any of these.
    expect(updated.entry?.rawNote).toBe('Field capture.');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('reassigns the engagement', async () => {
    const engagementId = await createEngagement(userId, 'Old Engagement Co');
    const replacementId = await createEngagement(userId, 'New Engagement Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Move me.' }),
      careerWorklogCreateOutputSchema,
    );

    const updated = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { engagementId: replacementId },
      }),
      careerWorklogUpdateOutputSchema,
    );

    expect(updated.entry?.engagementId).toBe(replacementId);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('links and unlinks a project', async () => {
    const engagementId = await createEngagement(userId, 'Project Link Co');
    const projectId = await createProject(userId, 'Linkable Project');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Project link.' }),
      careerWorklogCreateOutputSchema,
    );

    const linked = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { projectId },
      }),
      careerWorklogUpdateOutputSchema,
    );
    expect(linked.entry?.projectId).toBe(projectId);

    const unlinked = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { projectId: null },
      }),
      careerWorklogUpdateOutputSchema,
    );
    expect(unlinked.entry?.projectId).toBeNull();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('bumps updatedAt without touching loggedAt', async () => {
    const engagementId = await createEngagement(userId, 'Timestamp Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Timestamped.' }),
      careerWorklogCreateOutputSchema,
    );

    const updated = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { area: 'timestamps' },
      }),
      careerWorklogUpdateOutputSchema,
    );

    expect(updated.entry?.loggedAt).toBe(created.entry.loggedAt);
    expect(Date.parse(updated.entry!.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(created.entry.updatedAt),
    );

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('reopens a closed entry — the impact lifecycle is advisory', async () => {
    const engagementId = await createEngagement(userId, 'Lifecycle Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Outcome still unknown.',
        impactStatus: 'closed',
      }),
      careerWorklogCreateOutputSchema,
    );

    const reopened = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { impactStatus: 'open' },
      }),
      careerWorklogUpdateOutputSchema,
    );

    expect(reopened.entry?.impactStatus).toBe('open');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('replaces the evidence list wholesale', async () => {
    const engagementId = await createEngagement(userId, 'Evidence Replace Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Two artifacts.',
        evidence: [
          { kind: 'ticket', label: 'ENG-1' },
          { kind: 'doc', label: 'Runbook', url: 'https://example.com/runbook' },
        ],
      }),
      careerWorklogCreateOutputSchema,
    );
    expect(created.entry.evidence).toHaveLength(2);

    const updated = toolOutput(
      await callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { evidence: [{ kind: 'pr', label: 'PR 7', url: 'https://example.com/pr/7' }] },
      }),
      careerWorklogUpdateOutputSchema,
    );

    expect(updated.entry?.evidence).toEqual([
      { kind: 'pr', label: 'PR 7', url: 'https://example.com/pr/7' },
    ]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('rejects an update that touches an immutable field', async () => {
    const engagementId = await createEngagement(userId, 'Immutable Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Verbatim.' }),
      careerWorklogCreateOutputSchema,
    );

    for (const field of ['rawNote', 'loggedAt', 'id', 'updatedAt']) {
      await expect(
        callTool(userId, 'career_worklog_update', {
          id: created.entry.id,
          data: { [field]: 'rewritten' },
        }),
      ).rejects.toThrow('RAW_NOTE_IMMUTABLE');
    }

    const unchanged = toolOutput(
      await callTool(userId, 'career_worklog_entry', { id: created.entry.id }),
      careerWorklogEntryDetailSchema,
    );
    expect(unchanged.entry?.rawNote).toBe('Verbatim.');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('fails as not found for another owner’s engagement', async () => {
    const engagementId = await createEngagement(userId, 'Reassign Co');
    const otherEngagementId = await createEngagement(otherUserId, 'Private Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Mine.' }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { engagementId: otherEngagementId },
      }),
    ).rejects.toThrow('Career engagement not found');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('fails as not found for a nonexistent engagement', async () => {
    const engagementId = await createEngagement(userId, 'Missing Engagement Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Mine.' }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { engagementId: 'a3500001-0000-4000-8000-0000000000fc' },
      }),
    ).rejects.toThrow('Career engagement not found');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('fails as not found for another owner’s project', async () => {
    const engagementId = await createEngagement(userId, 'Foreign Project Co');
    const projectId = await createProject(otherUserId, 'Private Project');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Mine.' }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { projectId },
      }),
    ).rejects.toThrow('Career project not found');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('fails as not found for a nonexistent project', async () => {
    const engagementId = await createEngagement(userId, 'No Project Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Mine.' }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { projectId: 'a3500001-0000-4000-8000-0000000000fb' },
      }),
    ).rejects.toThrow('Career project not found');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('rejects an end date before the start date', async () => {
    const engagementId = await createEngagement(userId, 'Window Update Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Window.',
        occurredStart: '2026-04-10',
      }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { occurredEnd: '2026-04-01' },
      }),
    ).rejects.toThrow('occurredEnd must be on or after occurredStart.');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('rejects a start date after the existing end date', async () => {
    const engagementId = await createEngagement(userId, 'Start Moves Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', {
        engagementId,
        rawNote: 'Window.',
        occurredStart: '2026-04-10',
        occurredEnd: '2026-04-20',
      }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', {
        id: created.entry.id,
        data: { occurredStart: '2026-04-21' },
      }),
    ).rejects.toThrow('occurredEnd must be on or after occurredStart.');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('rejects an empty update', async () => {
    const engagementId = await createEngagement(userId, 'Empty Update Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Something.' }),
      careerWorklogCreateOutputSchema,
    );

    await expect(
      callTool(userId, 'career_worklog_update', { id: created.entry.id, data: {} }),
    ).rejects.toThrow();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('does not update another user’s entry', async () => {
    const engagementId = await createEngagement(userId, 'Guarded Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Private.' }),
      careerWorklogCreateOutputSchema,
    );

    const updated = toolOutput(
      await callTool(otherUserId, 'career_worklog_update', {
        id: created.entry.id,
        data: { impact: 'Leaked' },
      }),
      careerWorklogUpdateOutputSchema,
    );
    expect(updated.entry).toBeNull();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });
});

describe('career_worklog_entries', () => {
  it('filters by engagement, impact status, tag and date range, newest first', async () => {
    const engagementId = await createEngagement(userId, 'Filter Co');
    const otherEngagementId = await createEngagement(userId, 'Filter Other Co');
    const projectId = await createProject(userId, 'Filter Project');

    const seeded = [
      {
        engagementId,
        rawNote: 'Oldest entry.',
        occurredStart: '2026-01-10',
        impactStatus: 'closed' as const,
        tags: ['alpha'],
      },
      {
        engagementId,
        rawNote: 'Middle entry.',
        occurredStart: '2026-02-10',
        impactStatus: 'open' as const,
        tags: ['alpha', 'beta'],
      },
      {
        engagementId,
        rawNote: 'Newest entry.',
        occurredStart: '2026-03-10',
        impactStatus: 'open' as const,
        tags: ['beta'],
        projectId,
      },
      {
        engagementId: otherEngagementId,
        rawNote: 'Different engagement.',
        occurredStart: '2026-03-11',
      },
    ];

    const ids: string[] = [];
    for (const input of seeded) {
      const created = toolOutput(
        await callTool(userId, 'career_worklog_create', input),
        careerWorklogCreateOutputSchema,
      );
      ids.push(created.entry.id);
    }

    const byEngagement = toolOutput(
      await callTool(userId, 'career_worklog_entries', { engagementId }),
      careerWorklogEntriesSchema,
    );
    expect(byEngagement.entries.map((entry) => entry.rawNote)).toEqual([
      'Newest entry.',
      'Middle entry.',
      'Oldest entry.',
    ]);

    const byStatus = toolOutput(
      await callTool(userId, 'career_worklog_entries', { engagementId, impactStatus: 'closed' }),
      careerWorklogEntriesSchema,
    );
    expect(byStatus.entries.map((entry) => entry.rawNote)).toEqual(['Oldest entry.']);

    const byTag = toolOutput(
      await callTool(userId, 'career_worklog_entries', { engagementId, tag: 'beta' }),
      careerWorklogEntriesSchema,
    );
    expect(byTag.entries.map((entry) => entry.rawNote)).toEqual(['Newest entry.', 'Middle entry.']);

    const byProject = toolOutput(
      await callTool(userId, 'career_worklog_entries', { projectId }),
      careerWorklogEntriesSchema,
    );
    expect(byProject.entries.map((entry) => entry.rawNote)).toEqual(['Newest entry.']);

    const byDateRange = toolOutput(
      await callTool(userId, 'career_worklog_entries', {
        engagementId,
        occurredAfter: '2026-02-01',
        occurredBefore: '2026-03-31',
      }),
      careerWorklogEntriesSchema,
    );
    expect(byDateRange.entries.map((entry) => entry.rawNote)).toEqual([
      'Newest entry.',
      'Middle entry.',
    ]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', 'in', ids).execute();
  });

  it('breaks occurredStart ties on loggedAt, newest first', async () => {
    const engagementId = await createEngagement(userId, 'Tie Break Co');

    // loggedAt is server-set on the tool path, so seed it directly to make the
    // tie-break deterministic.
    const insert = async (rawNote: string, loggedAt: string) => {
      const row = await db
        .insertInto('app.careerWorklogEntries')
        .values({
          ownerUserid: userId,
          engagementId,
          rawNote,
          occurredStart: '2026-06-01',
          loggedAt,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    };

    const ids = await Promise.all([
      insert('First logged.', '2026-06-01T10:00:00Z'),
      insert('Third logged.', '2026-06-01T12:00:00Z'),
      insert('Second logged.', '2026-06-01T11:00:00Z'),
    ]);

    const listed = toolOutput(
      await callTool(userId, 'career_worklog_entries', { engagementId }),
      careerWorklogEntriesSchema,
    );
    expect(listed.entries.map((entry) => entry.rawNote)).toEqual([
      'Third logged.',
      'Second logged.',
      'First logged.',
    ]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', 'in', ids).execute();
  });

  it('does not list another user’s entries', async () => {
    const engagementId = await createEngagement(userId, 'Private List Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Private entry.' }),
      careerWorklogCreateOutputSchema,
    );

    const listed = toolOutput(
      await callTool(otherUserId, 'career_worklog_entries', { engagementId }),
      careerWorklogEntriesSchema,
    );
    expect(listed.entries.some((entry) => entry.id === created.entry.id)).toBe(false);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });
});

describe('career_worklog_entry', () => {
  it('returns the entry and its linked skill ids', async () => {
    const engagementId = await createEngagement(userId, 'Detail Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Detail entry.' }),
      careerWorklogCreateOutputSchema,
    );

    const detail = toolOutput(
      await callTool(userId, 'career_worklog_entry', { id: created.entry.id }),
      careerWorklogEntryDetailSchema,
    );
    expect(detail.entry?.id).toBe(created.entry.id);
    expect(detail.linkedSkillIds).toEqual([]);

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('does not expose another user’s entry', async () => {
    const engagementId = await createEngagement(userId, 'Private Detail Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Private.' }),
      careerWorklogCreateOutputSchema,
    );

    const detail = toolOutput(
      await callTool(otherUserId, 'career_worklog_entry', { id: created.entry.id }),
      careerWorklogEntryDetailSchema,
    );
    expect(detail.entry).toBeNull();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });
});

describe('career_worklog_delete', () => {
  it('removes the entry', async () => {
    const engagementId = await createEngagement(userId, 'Delete Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Doomed entry.' }),
      careerWorklogCreateOutputSchema,
    );

    const removed = toolOutput(
      await callTool(userId, 'career_worklog_delete', { id: created.entry.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(true);

    const gone = await db
      .selectFrom('app.careerWorklogEntries')
      .select('id')
      .where('id', '=', created.entry.id)
      .executeTakeFirst();
    expect(gone).toBeUndefined();
  });

  it('scrubs a deleted id from skill links once that column lands', async () => {
    // `app.career_skills.worklog_entry_ids` arrives with the follow-up issue, so
    // the scrub's active branch cannot run against today's schema. Add the column
    // inside a transaction that is rolled back, which proves the hook works the
    // day the column lands without changing the shipped schema.
    const engagementId = await createEngagement(userId, 'Scrub Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Scrub me.' }),
      careerWorklogCreateOutputSchema,
    );
    const untouchedId = 'a3500001-0000-4000-8000-0000000000aa';

    class Rollback extends Error {}

    try {
      await db.transaction().execute(async (trx) => {
        await sql`ALTER TABLE app.career_skills
          ADD COLUMN worklog_entry_ids jsonb NOT NULL DEFAULT '[]'::jsonb`.execute(trx);
        const skill = await trx
          .insertInto('app.careerSkills')
          .values({ ownerUserid: userId, name: 'Scrub Skill' })
          .returning('id')
          .executeTakeFirstOrThrow();
        await sql`UPDATE app.career_skills
          SET worklog_entry_ids = ${JSON.stringify([created.entry.id, untouchedId])}::jsonb
          WHERE id = ${skill.id}`.execute(trx);

        const scrubbed = await WorklogRepository.scrubSkillLinks(trx, userId, created.entry.id);
        expect(scrubbed).toBe(1);

        const row = await sql<{
          worklogEntryIds: string[];
        }>`SELECT worklog_entry_ids AS "worklogEntryIds"
          FROM app.career_skills WHERE id = ${skill.id}`.execute(trx);
        expect(row.rows[0]?.worklogEntryIds).toEqual([untouchedId]);

        throw new Rollback();
      });
    } catch (error) {
      if (!(error instanceof Rollback)) throw error;
    }

    // The rollback restored the shipped schema.
    const columns = await sql<{ columnName: string }>`SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'app' AND table_name = 'career_skills'`.execute(db);
    expect(columns.rows.map((column) => column.columnName)).not.toContain('worklog_entry_ids');

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('rolls the deletion back when the skill-link scrub fails', async () => {
    const engagementId = await createEngagement(userId, 'Atomic Delete Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Atomic.' }),
      careerWorklogCreateOutputSchema,
    );

    const scrub = vi
      .spyOn(WorklogRepository, 'scrubSkillLinks')
      .mockRejectedValueOnce(new Error('scrub failed'));
    try {
      await expect(
        callTool(userId, 'career_worklog_delete', { id: created.entry.id }),
      ).rejects.toThrow('scrub failed');
    } finally {
      scrub.mockRestore();
    }

    // The entry survives only because the delete and the scrub share one
    // transaction; without it the delete would already have committed.
    const stillThere = await db
      .selectFrom('app.careerWorklogEntries')
      .select('id')
      .where('id', '=', created.entry.id)
      .executeTakeFirst();
    expect(stillThere).toBeDefined();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('does not delete another user’s entry', async () => {
    const engagementId = await createEngagement(userId, 'Guarded Delete Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Survivor.' }),
      careerWorklogCreateOutputSchema,
    );

    const removed = toolOutput(
      await callTool(otherUserId, 'career_worklog_delete', { id: created.entry.id }),
      removedResultSchema,
    );
    expect(removed.removed).toBe(false);

    const survivor = await db
      .selectFrom('app.careerWorklogEntries')
      .select('id')
      .where('id', '=', created.entry.id)
      .executeTakeFirst();
    expect(survivor).toBeDefined();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });
});

describe('career worklog tool surface', () => {
  it('registers the five worklog tools', () => {
    const names = listTools()
      .filter((tool) => tool.name.startsWith('career_worklog_'))
      .map((tool) => tool.name)
      .sort();

    expect(names).toEqual([
      'career_worklog_create',
      'career_worklog_delete',
      'career_worklog_entries',
      'career_worklog_entry',
      'career_worklog_update',
    ]);
  });

  it('takes the career domain from 41 to 46 tools', () => {
    const careerTools = listTools().filter((tool) => tool.name.startsWith('career_'));
    expect(careerTools).toHaveLength(46);
  });

  it('advertises the worklog tools by scope', () => {
    const worklogNames = (scopes: string[]) =>
      listToolsForScopes(scopes)
        .map((tool) => tool.name)
        .filter((name) => name.startsWith('career_worklog_'))
        .sort();

    expect(worklogNames(['career:read', 'career:write'])).toEqual([
      'career_worklog_create',
      'career_worklog_delete',
      'career_worklog_entries',
      'career_worklog_entry',
      'career_worklog_update',
    ]);
    expect(worklogNames(['career:read'])).toEqual([
      'career_worklog_entries',
      'career_worklog_entry',
    ]);
    expect(worklogNames(['career:write'])).toEqual([
      'career_worklog_create',
      'career_worklog_delete',
      'career_worklog_update',
    ]);
  });

  it('annotates each tool with its mode', () => {
    expect(describeCapability(getToolDefinition('career_worklog_entries')!)).toContain(
      'Mode: read-only.',
    );
    expect(describeCapability(getToolDefinition('career_worklog_entry')!)).toContain(
      'Mode: read-only.',
    );
    expect(describeCapability(getToolDefinition('career_worklog_create')!)).toContain(
      'Mode: write.',
    );
    expect(describeCapability(getToolDefinition('career_worklog_update')!)).toContain(
      'Mode: write.',
    );
    expect(describeCapability(getToolDefinition('career_worklog_delete')!)).toContain(
      'Mode: write, confirmation required.',
    );
  });

  it('requires confirmation for the delete and nothing else', () => {
    expect(getToolDefinition('career_worklog_delete')).toMatchObject({
      destructive: true,
      idempotent: true,
      requiresConfirmation: true,
    });
    expect(getToolDefinition('career_worklog_create')).toMatchObject({
      destructive: false,
      idempotent: false,
    });
    expect(getToolDefinition('career_worklog_update')).toMatchObject({
      destructive: false,
      idempotent: true,
    });
  });

  it('previews the entry a confirmed delete would remove', async () => {
    const engagementId = await createEngagement(userId, 'Preview Co');
    const created = toolOutput(
      await callTool(userId, 'career_worklog_create', { engagementId, rawNote: 'Preview me.' }),
      careerWorklogCreateOutputSchema,
    );

    const preview = getToolDefinition('career_worklog_delete')?.preview;
    await expect(preview?.(userId, { id: created.entry.id })).resolves.toMatchObject({
      rawNote: 'Preview me.',
    });
    await expect(
      preview?.(userId, { id: 'a3500001-0000-4000-8000-0000000000ff' }),
    ).resolves.toBeNull();

    await db.deleteFrom('app.careerWorklogEntries').where('id', '=', created.entry.id).execute();
  });

  it('exposes the documented parameter names', () => {
    const properties = (name: string) =>
      Object.keys(
        z
          .object({ properties: z.record(z.string(), z.unknown()) })
          .parse(convertSchemaToJsonSchema(getToolDefinition(name)?.inputSchema ?? z.object({})))
          .properties,
      ).sort();

    expect(properties('career_worklog_entries')).toEqual([
      'engagementId',
      'impactStatus',
      'limit',
      'occurredAfter',
      'occurredBefore',
      'projectId',
      'tag',
    ]);
    expect(properties('career_worklog_entry')).toEqual(['id']);
    expect(properties('career_worklog_create')).toEqual([
      'action',
      'area',
      'engagementId',
      'evidence',
      'impact',
      'impactStatus',
      'knownLimits',
      'occurredEnd',
      'occurredStart',
      'problem',
      'projectId',
      'publicBullet',
      'rawNote',
      'sensitivity',
      'tags',
    ]);
    expect(properties('career_worklog_update')).toEqual(['data', 'id']);
    expect(properties('career_worklog_delete')).toEqual(['id']);
  });
});

describe('career worklog schema', () => {
  it('forces row-level security, not just enables it', async () => {
    // The table owner bypasses a policy that is only ENABLEd, so the owner check
    // would be no defence if a query ever dropped its owner predicate.
    const row = await sql<{ forced: boolean; enabled: boolean }>`
      SELECT relforcerowsecurity AS forced, relrowsecurity AS enabled
      FROM pg_class
      WHERE oid = 'app.career_worklog_entries'::regclass
    `.execute(db);

    expect(row.rows[0]).toEqual({ forced: true, enabled: true });
  });
});
