import { db, pool } from '@hominem/db/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { LEDGER_LOGGED_AT, runCareerLedgerMigration } from './career-ledger';

const userId = 'a3600001-0000-4000-8000-000000000001';

const WL_001_RAW =
  'in my first three weeks at Voy I fixed their chat reliability issues by implementing offline syncing with resumability etc';
const WL_002_RAW =
  'i fixed a security issue by switching from using JWT in mobile webviews to using short-lived one-time tokens';

// The canonical ledger text (issue #476's verbatim ledger comment), written out
// independently of the implementation so a copy edit on either side fails here.
const expectedWL001 = {
  occurredStart: '2026-09-29',
  occurredEnd: '2026-10-19',
  area: 'Joy chat (Stream Chat) — manualco/app-wl',
  problem:
    "Two compounding failures. (1) The chat screen mounted Stream's Chat provider only after connectUser finished its websocket handshake, so a slow or dead network delayed access to messages already stored on the device. (2) The silent-send bug: a sent message could simply disappear from the UI — sometimes the server had it, but channel loading or realtime misbehavior meant the sender couldn't tell. The capability review behind his Joy Plan found users locked out of chat for weeks, invisible in the support noise.",
  action:
    'Shipped PR #5935 "Enable offline StreamChat support" (branch refactor/streamchat-offline), in three parts:\n\n' +
    "1. Offline layer + startup restructure. Enabled Stream's SQLite-backed offline support (OP-SQLite, enableOfflineSupport). The serialized connection manager now exposes the client as soon as connectUser starts rather than after the handshake, with init-epoch guards so a stale initialization can't take over; the provider mounts early, cached channels and messages publish from the local DB before channel.watch() refreshes from the network.\n\n" +
    '2. Optimistic send + recovery. Rewired Joy\'s composer from calling the channel directly to Stream\'s MessageInput context, so sends create optimistic messages with a visible pending state (faded bubble, "Sending…" indicator). Bounded send timeout; the draft is restored on failure; a delivery watchdog detects an unhealthy socket or missing echo and attempts bounded, rate-limited realtime recovery.\n\n' +
    "3. Logout purge. Disconnect bumps the init epoch and purges the local offline database, so one account's chat data can't surface under the next account; a failed purge can't expose stale data.\n\n" +
    'Plus tests around the failure scenarios, and he presented the work internally (3-minute demo: before/after send behavior, offline persistence, recovery).',
  impact: null,
  impactStatus: 'open',
  tags: ['sync', 'reliability', 'chat', 'offline-first', 'Stream', 'SQLite', 'React Native'],
  sensitivity: 'mixed',
  publicBullet:
    "Fixed Joy's long-standing silent-send and disappearing-messages bugs and made chat offline-resilient: optimistic sends with visible delivery state, a local SQLite cache that renders before the network connects, and automatic recovery when the realtime connection drops.",
  knownLimits:
    "The offline cache is not encrypted at rest; threads and media remain limited by what Stream's offline layer supports.",
  evidence: [
    { kind: 'ticket', label: 'Linear JOY-2476', url: null },
    { kind: 'pr', label: 'PR manualco/app-wl#5935', url: null },
    {
      kind: 'doc',
      label: 'Notion (voy hub): "JOY-2476 — Stream Chat Offline Support (Engineering)"',
      url: null,
    },
    {
      kind: 'doc',
      label: 'Notion (voy hub): "Stream Chat Offline Support" presentation script',
      url: null,
    },
    {
      kind: 'doc',
      label:
        'Joy Plan [Oct → Jan], Month 1 infra: "Message delivery — optimistic message updates; fix the long-standing silent-send bug; fix disappearing messages."',
      url: null,
    },
  ],
  rawNote: WL_001_RAW,
};

const expectedWL002 = {
  occurredStart: '2026-09-29',
  occurredEnd: '2026-10-19',
  area: 'Mobile authentication / webviews — manualco/app-wl',
  problem:
    'Long-lived JWTs were being used inside mobile webviews. A JWT readable in a webview context is exposed to whatever runs in that context, and because it is long-lived and reusable, a single leaked token hands over the session for its full lifetime — no expiry safety net, no use limit.',
  action:
    "Migrated mobile webview authentication from JWTs to short-lived, one-time tokens (the \"OTT\" work): a token is minted for a single use and expires fast, so a captured token is worth almost nothing. Chase's role included review of the implementation — Liam authored four OTT pull requests, which Chase reviewed on Oct 17, 2026 (per his Oct 16 work plan). The exact minting/exchange flow isn't documented here — it lives in the PRs, which stay inside Voy's org.",
  impact: 'Shrinks the token-theft blast radius: a captured token is single-use and expires fast.',
  impactStatus: 'open',
  tags: ['security', 'authentication', 'mobile', 'tokens', 'webviews'],
  sensitivity: 'mixed',
  publicBullet:
    'Hardened mobile authentication by replacing long-lived webview tokens with short-lived, single-use tokens.',
  knownLimits: null,
  evidence: [
    {
      kind: 'other',
      label:
        "Chase's account (Oct 20, 2026) + his Oct 16–17 work plan (review of Liam's four OTT PRs)",
      url: null,
    },
  ],
  rawNote: WL_002_RAW,
};

async function createVoyEngagement() {
  return db
    .insertInto('app.careerEngagements')
    .values({ ownerUserid: userId, company: 'Voy', title: 'Lead Product Engineer' })
    .returning('id')
    .executeTakeFirstOrThrow();
}

async function createReactNativeSkill() {
  return db
    .insertInto('app.careerSkills')
    .values({ ownerUserid: userId, name: 'React Native' })
    .returning('id')
    .executeTakeFirstOrThrow();
}

async function ledgerRows() {
  return db
    .selectFrom('app.careerWorklogEntries')
    .selectAll()
    .where('ownerUserid', '=', userId)
    .execute();
}

beforeAll(async () => {
  await pool.query(
    'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
    [userId, 'Career Ledger Test User', `${userId}@test.hominem.dev`, true],
  );
});

beforeEach(async () => {
  await db.deleteFrom('app.careerWorklogEntries').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.careerSkills').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.careerEngagements').where('ownerUserid', '=', userId).execute();
  await createVoyEngagement();
  await createReactNativeSkill();
});

afterAll(async () => {
  await db.deleteFrom('app.careerWorklogEntries').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.careerSkills').where('ownerUserid', '=', userId).execute();
  await db.deleteFrom('app.careerEngagements').where('ownerUserid', '=', userId).execute();
});

describe('career ledger migration', () => {
  it('dry-runs by default and inserts nothing', async () => {
    const result = await runCareerLedgerMigration();

    expect(result.executed).toBe(false);
    expect(result.inserted).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.skillUpdated).toBe(false);
    expect(result.plan.entries).toHaveLength(2);
    expect(result.plan.entries.every((entry) => !entry.existing)).toBe(true);
    // The plan carries every field the insert needs, evidence included.
    expect(result.plan.entries[0]).toMatchObject(expectedWL001);
    expect(result.plan.entries[1]).toMatchObject(expectedWL002);
    expect(result.plan.entries[0]).toMatchObject({
      loggedAt: LEDGER_LOGGED_AT,
      projectId: null,
    });

    expect(await ledgerRows()).toEqual([]);
  });

  it('--execute inserts exactly the two ledger rows, field-for-field', async () => {
    const result = await runCareerLedgerMigration({ execute: true });

    expect(result.executed).toBe(true);
    expect(result.inserted).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(result.skillUpdated).toBe(true);

    const rows = await ledgerRows();
    expect(rows).toHaveLength(2);
    const byRawNote = new Map(rows.map((row) => [row.rawNote, row]));
    expect([...byRawNote.keys()].sort()).toEqual([WL_001_RAW, WL_002_RAW].sort());

    const wl001 = byRawNote.get(WL_001_RAW)!;
    expect(wl001).toEqual({
      ...expectedWL001,
      id: result.inserted[0],
      ownerUserid: userId,
      engagementId: result.plan.engagementId,
      projectId: null,
      loggedAt: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(wl001.loggedAt).toISOString()).toBe(LEDGER_LOGGED_AT);
    expect(wl001.rawNote).toBe(WL_001_RAW);

    const wl002 = byRawNote.get(WL_002_RAW)!;
    expect(wl002).toEqual({
      ...expectedWL002,
      id: result.inserted[1],
      ownerUserid: userId,
      engagementId: result.plan.engagementId,
      projectId: null,
      loggedAt: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(new Date(wl002.loggedAt).toISOString()).toBe(LEDGER_LOGGED_AT);

    // Worked example: the React Native skill now points at WL-001 only.
    const skill = await db
      .selectFrom('app.careerSkills')
      .select(['worklogEntryIds'])
      .where('id', '=', result.plan.skill.id)
      .executeTakeFirstOrThrow();
    expect(skill.worklogEntryIds).toEqual([wl001.id]);
  });

  it('is idempotent on (engagementId, rawNote): a second --execute creates zero rows', async () => {
    const first = await runCareerLedgerMigration({ execute: true });
    expect(first.inserted).toHaveLength(2);

    const second = await runCareerLedgerMigration({ execute: true });
    expect(second.executed).toBe(true);
    expect(second.inserted).toEqual([]);
    expect(second.skipped).toBe(2);
    expect(second.skillUpdated).toBe(false);
    expect(await ledgerRows()).toHaveLength(2);

    // The second run reuses the existing ids in its plan, so the link is stable.
    expect(second.plan.entries.map((entry) => entry.id).sort()).toEqual([...first.inserted].sort());
  });

  it('aborts before any write when the Voy engagement is missing', async () => {
    await db.deleteFrom('app.careerEngagements').where('ownerUserid', '=', userId).execute();

    await expect(runCareerLedgerMigration({ execute: true })).rejects.toThrow(
      /exactly one engagement/,
    );
    expect(await ledgerRows()).toEqual([]);
  });

  it('aborts before any write when the Voy engagement is ambiguous', async () => {
    await createVoyEngagement();

    await expect(runCareerLedgerMigration({ execute: true })).rejects.toThrow(
      /exactly one engagement/,
    );
    expect(await ledgerRows()).toEqual([]);
  });

  it('aborts before any write when the React Native skill is missing', async () => {
    await db.deleteFrom('app.careerSkills').where('ownerUserid', '=', userId).execute();

    await expect(runCareerLedgerMigration({ execute: true })).rejects.toThrow(
      /exactly one "React Native" skill/,
    );
    expect(await ledgerRows()).toEqual([]);
  });

  it('aborts before any write when the React Native skill is ambiguous', async () => {
    await createReactNativeSkill();

    await expect(runCareerLedgerMigration({ execute: true })).rejects.toThrow(
      /exactly one "React Native" skill/,
    );
    expect(await ledgerRows()).toEqual([]);
  });
});
