/**
 * One-off migration of the two prototype-ledger entries (WL-001, WL-002) into
 * `app.career_worklog_entries`, plus the worked-example skill link.
 *
 * This is a data operation, not the public create tool: it sets `loggedAt`
 * explicitly (2026-10-20T12:00:00Z), which the API deliberately refuses from a
 * client. It is dry-run by default and idempotent on `(engagementId, rawNote)`,
 * so a second `--execute` creates zero rows.
 *
 * Source text: `career-ledger/LEDGER.md` as reproduced verbatim in issue #476's
 * canonical-ledger comment. Where that text and the issue body's transcription
 * differ, the canonical ledger text wins.
 */
import { SkillRepository } from '@hominem/db/career';
import type { CareerWorklogEvidence } from '@hominem/db/career';
import { db, runInTransaction, sql, type DbHandle } from '@hominem/db/core';

export const LEDGER_LOGGED_AT = '2026-10-20T12:00:00.000Z';
export const LEDGER_OCCURRED_START = '2026-09-29';
export const LEDGER_OCCURRED_END = '2026-10-19';
export const VOY_ENGAGEMENT = { company: 'Voy', title: 'Lead Product Engineer' } as const;
export const WORKED_EXAMPLE_SKILL = 'React Native';

type LedgerEntrySpec = {
  id: string;
  occurredStart: string;
  occurredEnd: string;
  loggedAt: string;
  area: string;
  problem: string;
  action: string;
  impact: string | null;
  impactStatus: 'open';
  tags: string[];
  sensitivity: 'mixed';
  publicBullet: string;
  knownLimits: string | null;
  evidence: CareerWorklogEvidence[];
  rawNote: string;
  projectId: null;
};

export type LedgerEntryPlan = LedgerEntrySpec & {
  ownerUserid: string;
  engagementId: string;
  existing: boolean;
};

export type LedgerMigrationPlan = {
  ownerUserId: string;
  engagementId: string;
  skill: {
    id: string;
    name: string;
    currentWorklogEntryIds: string[];
    nextWorklogEntryIds: string[];
    changed: boolean;
  };
  entries: LedgerEntryPlan[];
};

export type LedgerMigrationResult = {
  executed: boolean;
  inserted: string[];
  skipped: number;
  skillUpdated: boolean;
  plan: LedgerMigrationPlan;
};

const WL_001: Omit<LedgerEntrySpec, 'id'> = {
  occurredStart: LEDGER_OCCURRED_START,
  occurredEnd: LEDGER_OCCURRED_END,
  loggedAt: LEDGER_LOGGED_AT,
  projectId: null,
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
  rawNote:
    'in my first three weeks at Voy I fixed their chat reliability issues by implementing offline syncing with resumability etc',
};

const WL_002: Omit<LedgerEntrySpec, 'id'> = {
  occurredStart: LEDGER_OCCURRED_START,
  occurredEnd: LEDGER_OCCURRED_END,
  loggedAt: LEDGER_LOGGED_AT,
  projectId: null,
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
  rawNote:
    'i fixed a security issue by switching from using JWT in mobile webviews to using short-lived one-time tokens',
};

function ledgerSpecs(): Array<Omit<LedgerEntrySpec, 'id'>> {
  return [WL_001, WL_002];
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function fail(message: string): never {
  throw new Error(`career ledger migration aborted: ${message}`);
}

/**
 * Resolves the Voy engagement and the worked-example skill, and decides which
 * entries are missing — all before any write. Throws rather than guessing when
 * either lookup is missing or ambiguous.
 */
export async function planCareerLedgerMigration(
  handle: DbHandle = db,
): Promise<LedgerMigrationPlan> {
  const engagements = await handle
    .selectFrom('app.careerEngagements')
    .select(['id', 'ownerUserid'])
    .where('company', '=', VOY_ENGAGEMENT.company)
    .where('title', '=', VOY_ENGAGEMENT.title)
    .execute();

  if (engagements.length !== 1) {
    fail(
      `expected exactly one engagement (company "${VOY_ENGAGEMENT.company}", title "${VOY_ENGAGEMENT.title}"), found ${engagements.length}. Create it before running this script.`,
    );
  }
  const engagement = engagements[0]!;
  const ownerUserId = engagement.ownerUserid;

  const skills = await handle
    .selectFrom('app.careerSkills')
    .select(['id', 'name', 'worklogEntryIds'])
    .where('ownerUserid', '=', ownerUserId)
    .where('name', '=', WORKED_EXAMPLE_SKILL)
    .execute();

  if (skills.length !== 1) {
    fail(
      `expected exactly one "${WORKED_EXAMPLE_SKILL}" skill for the engagement owner, found ${skills.length}.`,
    );
  }
  const skill = skills[0]!;
  const currentWorklogEntryIds = readStringArray(skill.worklogEntryIds);

  const entries: LedgerEntryPlan[] = [];
  for (const spec of ledgerSpecs()) {
    const existing = await handle
      .selectFrom('app.careerWorklogEntries')
      .select('id')
      .where('engagementId', '=', engagement.id)
      .where('rawNote', '=', spec.rawNote)
      .executeTakeFirst();

    entries.push({
      ...spec,
      id: existing?.id ?? crypto.randomUUID(),
      ownerUserid: ownerUserId,
      engagementId: engagement.id,
      existing: existing !== undefined,
    });
  }

  const wl001 = entries[0]!;
  const nextWorklogEntryIds = currentWorklogEntryIds.includes(wl001.id)
    ? currentWorklogEntryIds
    : [...currentWorklogEntryIds, wl001.id];

  return {
    ownerUserId,
    engagementId: engagement.id,
    skill: {
      id: skill.id,
      name: skill.name,
      currentWorklogEntryIds,
      nextWorklogEntryIds,
      changed: nextWorklogEntryIds.length !== currentWorklogEntryIds.length,
    },
    entries,
  };
}

async function insertEntry(handle: DbHandle, entry: LedgerEntryPlan): Promise<void> {
  await handle
    .insertInto('app.careerWorklogEntries')
    .values({
      id: entry.id,
      ownerUserid: entry.ownerUserid,
      engagementId: entry.engagementId,
      projectId: entry.projectId,
      occurredStart: entry.occurredStart,
      occurredEnd: entry.occurredEnd,
      loggedAt: entry.loggedAt,
      area: entry.area,
      problem: entry.problem,
      action: entry.action,
      impact: entry.impact,
      impactStatus: entry.impactStatus,
      tags: sql`${JSON.stringify(entry.tags)}::jsonb`,
      sensitivity: entry.sensitivity,
      publicBullet: entry.publicBullet,
      knownLimits: entry.knownLimits,
      evidence: sql`${JSON.stringify(entry.evidence)}::jsonb`,
      rawNote: entry.rawNote,
    })
    .execute();
}

/**
 * Plans first, then — only with `execute` — inserts the missing entries and adds
 * WL-001 to the skill's links in one transaction. Dry-run writes nothing.
 */
export async function runCareerLedgerMigration(
  options: { execute?: boolean; handle?: DbHandle } = {},
): Promise<LedgerMigrationResult> {
  const { execute = false, handle = db } = options;
  const plan = await planCareerLedgerMigration(handle);
  const missing = plan.entries.filter((entry) => !entry.existing);

  if (!execute) {
    return {
      executed: false,
      inserted: [],
      skipped: plan.entries.length - missing.length,
      skillUpdated: false,
      plan,
    };
  }

  const inserted = await runInTransaction(async (trx) => {
    for (const entry of missing) {
      await insertEntry(trx, entry);
    }
    if (plan.skill.changed) {
      await SkillRepository.update(trx, plan.ownerUserId, plan.skill.id, {
        worklogEntryIds: plan.skill.nextWorklogEntryIds,
      });
    }
    return missing.map((entry) => entry.id);
  });

  return {
    executed: true,
    inserted,
    skipped: plan.entries.length - missing.length,
    skillUpdated: plan.skill.changed,
    plan,
  };
}
