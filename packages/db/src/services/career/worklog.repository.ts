import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type {
  AppCareerWorklogEntries,
  AppCareerWorklogImpactStatus,
  AppCareerWorklogSensitivity,
  Json,
} from '../../types/database';

export type CareerWorklogEvidenceKind = 'ticket' | 'pr' | 'doc' | 'link' | 'other';

export type CareerWorklogEvidence = {
  kind: CareerWorklogEvidenceKind;
  label: string;
  url: string | null;
};

/** The worklog entry as the API exposes it: flat, JSON-serializable, no row types. */
export type CareerWorklogEntry = {
  id: string;
  engagementId: string;
  projectId: string | null;
  occurredStart: string;
  occurredEnd: string | null;
  loggedAt: string;
  updatedAt: string;
  area: string | null;
  problem: string | null;
  action: string | null;
  impact: string | null;
  impactStatus: AppCareerWorklogImpactStatus;
  tags: string[];
  sensitivity: AppCareerWorklogSensitivity;
  publicBullet: string | null;
  knownLimits: string | null;
  evidence: CareerWorklogEvidence[];
  rawNote: string;
};

export type CareerWorklogCreateInput = {
  engagementId: string;
  rawNote: string;
  projectId?: string | null;
  occurredStart?: string;
  occurredEnd?: string | null;
  area?: string | null;
  problem?: string | null;
  action?: string | null;
  impact?: string | null;
  impactStatus?: AppCareerWorklogImpactStatus;
  tags?: string[];
  sensitivity?: AppCareerWorklogSensitivity;
  publicBullet?: string | null;
  knownLimits?: string | null;
  evidence?: CareerWorklogEvidence[];
};

/**
 * Every mutable field. `rawNote` is absent on purpose: it is the user's words,
 * captured once and never rewritten.
 */
export type CareerWorklogUpdateInput = Partial<Omit<CareerWorklogCreateInput, 'rawNote'>>;

export type CareerWorklogListFilters = {
  engagementId?: string;
  projectId?: string;
  skillId?: string;
  impactStatus?: AppCareerWorklogImpactStatus;
  tag?: string;
  occurredAfter?: string;
  occurredBefore?: string;
  limit?: number;
};

type WorklogRow = Selectable<AppCareerWorklogEntries>;

const evidenceKinds: Record<string, CareerWorklogEvidenceKind | undefined> = {
  ticket: 'ticket',
  pr: 'pr',
  doc: 'doc',
  link: 'link',
  other: 'other',
};

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toTags(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toEvidence(value: Json): CareerWorklogEvidence[] {
  if (!Array.isArray(value)) return [];
  const evidence: CareerWorklogEvidence[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const kind = typeof item.kind === 'string' ? evidenceKinds[item.kind] : undefined;
    if (!kind || typeof item.label !== 'string') continue;
    evidence.push({
      kind,
      label: item.label,
      url: typeof item.url === 'string' ? item.url : null,
    });
  }
  return evidence;
}

function toEntry(row: WorklogRow): CareerWorklogEntry {
  return {
    id: row.id,
    engagementId: row.engagementId,
    projectId: row.projectId,
    occurredStart: row.occurredStart,
    occurredEnd: row.occurredEnd,
    loggedAt: row.loggedAt,
    updatedAt: row.updatedAt,
    area: row.area,
    problem: row.problem,
    action: row.action,
    impact: row.impact,
    impactStatus: row.impactStatus,
    tags: toTags(row.tags),
    sensitivity: row.sensitivity,
    publicBullet: row.publicBullet,
    knownLimits: row.knownLimits,
    evidence: toEvidence(row.evidence),
    rawNote: row.rawNote,
  };
}

export const WorklogRepository = {
  async list(
    handle: DbHandle,
    ownerUserId: string,
    filters: CareerWorklogListFilters = {},
  ): Promise<CareerWorklogEntry[]> {
    let query = handle
      .selectFrom('app.careerWorklogEntries')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId);

    if (filters.engagementId) {
      query = query.where('engagementId', '=', filters.engagementId);
    }
    if (filters.projectId) {
      query = query.where('projectId', '=', filters.projectId);
    }
    if (filters.skillId) {
      // The link lives on the skill: an entry matches when the caller's skill
      // lists its id.
      query = query.where(sql<boolean>`EXISTS (
        SELECT 1
        FROM app.career_skills AS skill
        WHERE skill.id = ${filters.skillId}::uuid
          AND skill.owner_userid = ${ownerUserId}
          AND skill.worklog_entry_ids @> to_jsonb("career_worklog_entries"."id"::text)
      )`);
    }
    if (filters.impactStatus) {
      query = query.where('impactStatus', '=', filters.impactStatus);
    }
    if (filters.tag) {
      // `tags` is a jsonb array of strings; containment is the "has this tag" test.
      query = query.where(sql<boolean>`"tags" @> ${JSON.stringify([filters.tag])}::jsonb`);
    }
    if (filters.occurredAfter) {
      query = query.where('occurredStart', '>=', filters.occurredAfter);
    }
    if (filters.occurredBefore) {
      query = query.where('occurredStart', '<=', filters.occurredBefore);
    }

    const rows = await query
      .orderBy('occurredStart', 'desc')
      .orderBy('loggedAt', 'desc')
      .limit(filters.limit ?? 20)
      .execute();

    return rows.map(toEntry);
  },

  async get(handle: DbHandle, ownerUserId: string, id: string): Promise<CareerWorklogEntry | null> {
    const row = await handle
      .selectFrom('app.careerWorklogEntries')
      .selectAll()
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row ? toEntry(row) : null;
  },

  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: CareerWorklogCreateInput,
  ): Promise<CareerWorklogEntry> {
    const { tags, evidence, ...rest } = input;
    const row = await handle
      .insertInto('app.careerWorklogEntries')
      .values({
        ...rest,
        ownerUserid: ownerUserId,
        // pg serializes a bare JS array as a Postgres array literal, not JSON, so a
        // jsonb column needs the value passed as a JSON string with an explicit cast.
        tags: sql`${JSON.stringify(tags ?? [])}::jsonb`,
        evidence: sql`${JSON.stringify(evidence ?? [])}::jsonb`,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toEntry(row);
  },

  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    input: CareerWorklogUpdateInput,
  ): Promise<CareerWorklogEntry | null> {
    const { tags, evidence, ...rest } = input;
    const updated = await handle
      .updateTable('app.careerWorklogEntries')
      .set({
        ...rest,
        ...(tags === undefined ? {} : { tags: sql`${JSON.stringify(tags)}::jsonb` }),
        ...(evidence === undefined ? {} : { evidence: sql`${JSON.stringify(evidence)}::jsonb` }),
      })
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returningAll()
      .executeTakeFirst();
    return updated ? toEntry(updated) : null;
  },

  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const deleted = await handle
      .deleteFrom('app.careerWorklogEntries')
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returning('id')
      .executeTakeFirst();
    return deleted !== undefined;
  },

  async engagementBelongsToOwner(
    handle: DbHandle,
    ownerUserId: string,
    engagementId: string,
  ): Promise<boolean> {
    const row = await handle
      .selectFrom('app.careerEngagements')
      .select('id')
      .where('id', '=', engagementId)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row !== undefined;
  },

  /** Every id must exist on the owner's own entries; a duplicate id is still one entry. */
  async entriesBelongToOwner(
    handle: DbHandle,
    ownerUserId: string,
    ids: string[],
  ): Promise<boolean> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return true;

    const rows = await handle
      .selectFrom('app.careerWorklogEntries')
      .select('id')
      .where('ownerUserid', '=', ownerUserId)
      .where('id', 'in', unique)
      .execute();
    return rows.length === unique.length;
  },

  async projectBelongsToOwner(
    handle: DbHandle,
    ownerUserId: string,
    projectId: string,
  ): Promise<boolean> {
    const row = await handle
      .selectFrom('app.careerProjects')
      .select('id')
      .where('id', '=', projectId)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row !== undefined;
  },

  /**
   * Drops a deleted entry's id from every skill that points at it, in the same
   * transaction as the delete so a failure rolls both back.
   */
  async scrubSkillLinks(
    handle: DbHandle,
    ownerUserId: string,
    worklogEntryId: string,
  ): Promise<number> {
    const scrubbed = await sql`
      UPDATE app.career_skills
      SET worklog_entry_ids = (
        SELECT COALESCE(jsonb_agg(element), '[]'::jsonb)
        FROM jsonb_array_elements(worklog_entry_ids) AS element
        WHERE element <> to_jsonb(${worklogEntryId}::text)
      )
      WHERE owner_userid = ${ownerUserId}
        AND worklog_entry_ids @> to_jsonb(${worklogEntryId}::text)
    `.execute(handle);
    return Number(scrubbed.numAffectedRows ?? 0);
  },
};
