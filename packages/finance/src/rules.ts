import { db, sql } from '@hominem/db/core';
import type { AppFinanceRules } from '@hominem/db/types';
import type { Updateable } from 'kysely';

import { resolveFinanceCategory } from './sheet-import';

/**
 * Owner-scoped automation rules: a description pattern that files a matching transaction into one
 * category. The merge flow repoints rules (see `taxonomy.ts`), which is why a rule addresses its
 * category by id and why the category foreign key is RESTRICT.
 */

export const FINANCE_RULE_MATCH_MODES = ['exact', 'contains', 'regex'] as const;
export type FinanceRuleMatchMode = (typeof FINANCE_RULE_MATCH_MODES)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FinanceRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchMode: FinanceRuleMatchMode;
  matchPattern: string;
  /** The category this rule files matched transactions into. */
  category: { id: string; name: string };
}

export type FinanceRuleReason =
  | 'duplicate_name'
  | 'invalid_name'
  | 'invalid_pattern'
  | 'unknown_category'
  | 'unknown_rule'
  | null;

interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchMode: string;
  matchPattern: string;
  categoryId: string;
  categoryName: string;
}

function isMatchMode(value: string): value is FinanceRuleMatchMode {
  return FINANCE_RULE_MATCH_MODES.some((mode) => mode === value);
}

function toRule(row: RuleRow): FinanceRule {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    priority: row.priority,
    // The column is CHECK-constrained to these values; the fallback is unreachable but keeps the
    // boundary total without a cast.
    matchMode: isMatchMode(row.matchMode) ? row.matchMode : 'contains',
    matchPattern: row.matchPattern,
    category: { id: row.categoryId, name: row.categoryName },
  };
}

function rulesQuery(userId: string) {
  return db
    .selectFrom('app.financeRules as r')
    .innerJoin('app.financeCategories as c', 'c.id', 'r.actionCategoryId')
    .select([
      'r.id as id',
      'r.name as name',
      'r.enabled as enabled',
      'r.priority as priority',
      'r.matchMode as matchMode',
      'r.matchPattern as matchPattern',
      'c.id as categoryId',
      'c.name as categoryName',
    ])
    .where('r.userId', '=', userId);
}

export async function listFinanceRules(userId: string): Promise<FinanceRule[]> {
  const rows = await rulesQuery(userId)
    .orderBy('r.priority', 'asc')
    .orderBy('r.name', 'asc')
    .limit(500)
    .execute();
  return rows.map(toRule);
}

async function findOwnedRule(userId: string, nameOrId: string) {
  const trimmed = nameOrId.trim();
  const base = db
    .selectFrom('app.financeRules')
    .select(['id', 'name'])
    .where('userId', '=', userId);
  return UUID_PATTERN.test(trimmed)
    ? base.where('id', '=', trimmed).limit(1).executeTakeFirst()
    : base
        .where(sql<boolean>`lower(name) = lower(${trimmed})`)
        .limit(1)
        .executeTakeFirst();
}

async function nameTaken(userId: string, name: string, exceptId?: string): Promise<boolean> {
  let query = db
    .selectFrom('app.financeRules')
    .select('id')
    .where('userId', '=', userId)
    .where(sql<boolean>`lower(name) = lower(${name})`);
  if (exceptId) query = query.where('id', '!=', exceptId);
  return Boolean(await query.limit(1).executeTakeFirst());
}

export interface CreateFinanceRuleInput {
  name: string;
  category: string;
  matchPattern: string;
  matchMode?: FinanceRuleMatchMode;
  enabled?: boolean;
  priority?: number;
}

export async function createFinanceRule(
  userId: string,
  input: CreateFinanceRuleInput,
): Promise<{ rule: FinanceRule | null; reason: FinanceRuleReason }> {
  const name = input.name.trim();
  if (!name) return { rule: null, reason: 'invalid_name' };
  const matchPattern = input.matchPattern.trim();
  if (!matchPattern) return { rule: null, reason: 'invalid_pattern' };

  const category = await resolveFinanceCategory(userId, input.category);
  if (!category) return { rule: null, reason: 'unknown_category' };
  if (await nameTaken(userId, name)) return { rule: null, reason: 'duplicate_name' };

  const inserted = await db
    .insertInto('app.financeRules')
    .values({
      userId,
      name,
      matchPattern,
      actionCategoryId: category.id,
      ...(input.matchMode ? { matchMode: input.matchMode } : {}),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
    })
    .returning('id')
    .executeTakeFirst();
  if (!inserted) return { rule: null, reason: 'duplicate_name' };

  const row = await rulesQuery(userId).where('r.id', '=', inserted.id).executeTakeFirstOrThrow();
  return { rule: toRule(row), reason: null };
}

export interface UpdateFinanceRuleInput {
  rule: string;
  name?: string;
  category?: string;
  matchPattern?: string;
  matchMode?: FinanceRuleMatchMode;
  enabled?: boolean;
  priority?: number;
  dryRun?: boolean;
}

/**
 * Update a rule, including repointing it at another category — the move a blocked merge asks for.
 */
export async function updateFinanceRule(
  userId: string,
  input: UpdateFinanceRuleInput,
): Promise<{ rule: FinanceRule | null; reason: FinanceRuleReason }> {
  const existing = await findOwnedRule(userId, input.rule);
  if (!existing) return { rule: null, reason: 'unknown_rule' };

  const updates: Updateable<AppFinanceRules> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { rule: null, reason: 'invalid_name' };
    if (await nameTaken(userId, name, existing.id)) return { rule: null, reason: 'duplicate_name' };
    updates.name = name;
  }
  if (input.matchPattern !== undefined) {
    const matchPattern = input.matchPattern.trim();
    if (!matchPattern) return { rule: null, reason: 'invalid_pattern' };
    updates.matchPattern = matchPattern;
  }
  if (input.category !== undefined) {
    const category = await resolveFinanceCategory(userId, input.category);
    if (!category) return { rule: null, reason: 'unknown_category' };
    updates.actionCategoryId = category.id;
  }
  if (input.enabled !== undefined) updates.enabled = input.enabled;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.matchMode !== undefined) updates.matchMode = input.matchMode;

  if (Object.keys(updates).length > 0 && !input.dryRun) {
    await db
      .updateTable('app.financeRules')
      .set(updates)
      .where('userId', '=', userId)
      .where('id', '=', existing.id)
      .execute();
  }

  const row = await rulesQuery(userId).where('r.id', '=', existing.id).executeTakeFirst();
  return { rule: row ? toRule(row) : null, reason: row ? null : 'unknown_rule' };
}

export async function deleteFinanceRule(
  userId: string,
  nameOrId: string,
): Promise<{ rule: { id: string; name: string } | null; reason: FinanceRuleReason }> {
  const existing = await findOwnedRule(userId, nameOrId);
  if (!existing) return { rule: null, reason: 'unknown_rule' };

  await db
    .deleteFrom('app.financeRules')
    .where('userId', '=', userId)
    .where('id', '=', existing.id)
    .execute();
  return { rule: existing, reason: null };
}
