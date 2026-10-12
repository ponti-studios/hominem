import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import {
  ContainerRepository,
  PossessionRepository,
  type ContainerRecord,
  type Json,
  type PossessionEvent,
  type PossessionEventKind,
  type PossessionRecord,
  type PossessionSummary,
} from '@hominem/db/possessions';
import { runInTransaction } from '@hominem/db/transaction';

import type {
  ContainerCreateInput,
  ContainerSearchInput,
  ContainerUpdateInput,
  PossessionCreateInput,
  PossessionListQuery,
  PossessionSearchInput,
  PossessionUpdateInput,
} from '../schemas/possessions.schema';

// The single implementation behind the possessions routes. Writes that validate a reference
// (container ownership, nesting cycles) run in a transaction so a rejection leaves nothing behind.

// Every possession write records one history event in the same transaction, so the audit log
// can never drift from the rows. Hard deletes cascade their events away, so DELETE emits nothing.
const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value ?? null));

const definedFields = (input: Record<string, unknown>): Record<string, Json> => {
  const fields: Record<string, Json> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) fields[key] = toJson(value);
  }
  return fields;
};

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const changedFields = (
  before: PossessionRecord,
  after: PossessionRecord,
  keys: string[],
): Record<string, Json> => {
  const beforeMap = new Map(Object.entries(before));
  const afterMap = new Map(Object.entries(after));
  const diff: Record<string, Json> = {};
  for (const key of keys) {
    const pair = { before: toJson(beforeMap.get(key)), after: toJson(afterMap.get(key)) };
    if (!sameJson(pair.before, pair.after)) diff[key] = pair;
  }
  return diff;
};

const classifyUpdate = (
  before: PossessionRecord,
  after: PossessionRecord,
  input: PossessionUpdateInput,
): PossessionEventKind => {
  if (!before.isArchived && after.isArchived) return 'archived';
  if (input.status !== undefined && before.status !== after.status) return 'status_changed';
  if (input.containerId !== undefined && before.containerId !== after.containerId) return 'moved';
  return 'updated';
};

export async function listPossessions(
  userId: string,
  query: PossessionListQuery,
): Promise<PossessionRecord[]> {
  return PossessionRepository.list(db, {
    userId,
    ...(query.status.length ? { statuses: query.status } : {}),
    ...(query.archived ? { archived: query.archived === 'true' } : {}),
    ...(query.containerId ? { containerId: query.containerId } : {}),
    ...(query.limit ? { limit: query.limit } : {}),
  });
}

export const createPossession = (
  userId: string,
  input: PossessionCreateInput,
): Promise<PossessionRecord> =>
  runInTransaction(async (trx) => {
    const saved = await PossessionRepository.create(trx, userId, input);
    await PossessionRepository.recordEvent(trx, userId, saved.id, 'created', {
      after: definedFields(input),
    });
    return saved;
  });

export const updatePossession = (
  userId: string,
  id: string,
  input: PossessionUpdateInput,
): Promise<PossessionRecord> =>
  runInTransaction(async (trx) => {
    const before =
      (await PossessionRepository.get(trx, userId, id)) ??
      (() => {
        throw new NotFoundError('Possession');
      })();
    const after = await PossessionRepository.update(trx, userId, id, input);
    const diff = changedFields(before, after, Object.keys(input));
    await PossessionRepository.recordEvent(
      trx,
      userId,
      id,
      classifyUpdate(before, after, input),
      diff,
    );
    return after;
  });

export const removePossession = (userId: string, id: string): Promise<void> =>
  PossessionRepository.remove(db, userId, id);

export const listContainers = (userId: string): Promise<ContainerRecord[]> =>
  ContainerRepository.list(db, userId);

export const createContainer = (
  userId: string,
  input: ContainerCreateInput,
): Promise<ContainerRecord> =>
  runInTransaction((trx) => ContainerRepository.create(trx, userId, input));

export const updateContainer = (
  userId: string,
  id: string,
  input: ContainerUpdateInput,
): Promise<ContainerRecord> =>
  runInTransaction((trx) => ContainerRepository.update(trx, userId, id, input));

export const removeContainer = (userId: string, id: string): Promise<void> =>
  ContainerRepository.remove(db, userId, id);

// MCP-facing variants. A missing row is an expected outcome for a tool, so these return null/false
// instead of throwing; the REST routes keep using the throwing functions above.
// `missing` is the exact message of the target row's NotFoundError, so a missing *reference*
// (e.g. "Container not found" while updating a possession) still surfaces as a real error.
const orNull = async <T>(missing: string, run: () => Promise<T>): Promise<T | null> => {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError && error.message === missing) return null;
    throw error;
  }
};

export const searchPossessions = (
  userId: string,
  input: PossessionSearchInput,
): Promise<PossessionRecord[]> =>
  PossessionRepository.list(db, {
    userId,
    ...(input.status?.length ? { statuses: input.status } : {}),
    ...(input.archived !== undefined ? { archived: input.archived } : {}),
    ...(input.containerId ? { containerId: input.containerId } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.query ? { query: input.query } : {}),
    limit: input.limit,
    offset: input.offset,
  });

export const getPossession = (userId: string, id: string): Promise<PossessionRecord | null> =>
  PossessionRepository.get(db, userId, id);

export const summarizePossessions = (userId: string): Promise<PossessionSummary> =>
  PossessionRepository.summarize(db, userId);

export const movePossessions = (
  userId: string,
  ids: string[],
  containerId: string | null,
): Promise<{ moved: string[]; missing: string[] }> =>
  runInTransaction(async (trx) => {
    const unique = [...new Set(ids)];
    const before = new Map(
      (await PossessionRepository.listByIds(trx, userId, unique)).map((p) => [p.id, p]),
    );
    const moved = await PossessionRepository.move(trx, userId, unique, containerId);
    for (const id of moved) {
      const was = before.get(id)?.containerId ?? null;
      if (was !== containerId) {
        await PossessionRepository.recordEvent(trx, userId, id, 'moved', {
          before: { containerId: was },
          after: { containerId },
        });
      }
    }
    const movedSet = new Set(moved);
    return { moved, missing: unique.filter((id) => !movedSet.has(id)) };
  });

export const getPossessionHistory = (
  userId: string,
  id: string,
  limit: number,
): Promise<PossessionEvent[]> => PossessionRepository.history(db, userId, id, limit);

export interface VesselWeightRow {
  vessel: string;
  contentsKg: number;
  tareKg: number;
  totalKg: number;
  limitKg: number | null;
  notes: string | null;
  group: string | null;
  overLimit: boolean;
  unknownVessel: boolean;
}

export interface VesselWeightReport {
  vessels: VesselWeightRow[];
  groups: Array<{
    group: string;
    contentsKg: number;
    tareKg: number;
    totalKg: number;
    limitKg: number;
    overLimit: boolean;
  }>;
  unassigned: { count: number; weightKg: number };
}

const roundKg = (value: number) => Math.round(value * 1000) / 1000;

interface VesselGraph {
  containers: ContainerRecord[];
  byName: Map<string, ContainerRecord>;
  outermostName: (containerId: string) => string | null;
}

async function loadVesselGraph(userId: string): Promise<VesselGraph> {
  const containers = await ContainerRepository.list(db, userId);
  const byId = new Map(containers.map((c) => [c.id, c]));
  const byName = new Map<string, ContainerRecord>();
  for (const container of containers) {
    const key = container.name.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, container);
  }
  const outermostName = (containerId: string): string | null => {
    let current = byId.get(containerId);
    if (!current) return null;
    const seen = new Set<string>();
    while (
      current.parentContainerId &&
      byId.get(current.parentContainerId) &&
      !seen.has(current.id)
    ) {
      seen.add(current.id);
      current = byId.get(current.parentContainerId)!;
    }
    return current.name;
  };
  return { containers, byName, outermostName };
}

// The weights-tab replacement (plan §6.5): every live item's weight rolls up to exactly one
// vessel. moveAction wins when set (the sheet's Q column); otherwise the item follows its
// innermost container up to the outermost ancestor. A token matching no container is still
// summed under its own row but flagged unknownVessel — the vacuum_shirts_tees ghost class —
// so a typo can never silently vanish from the totals.
export async function vesselWeightReport(userId: string): Promise<VesselWeightReport> {
  const [graph, items] = await Promise.all([
    loadVesselGraph(userId),
    PossessionRepository.weighables(db, userId),
  ]);
  const { containers, byName, outermostName } = graph;

  const rows = new Map<string, { display: string; contentsKg: number }>();
  let unassignedCount = 0;
  let unassignedKg = 0;
  for (const item of items) {
    const token =
      item.moveAction?.trim() || (item.containerId ? outermostName(item.containerId) : null);
    if (!token) {
      unassignedCount += 1;
      unassignedKg += item.weightKg ?? 0;
      continue;
    }
    const key = token.toLowerCase();
    const row = rows.get(key) ?? { display: token, contentsKg: 0 };
    row.contentsKg += item.weightKg ?? 0;
    rows.set(key, row);
  }

  const vessels: VesselWeightRow[] = [];
  for (const [key, row] of rows) {
    const container = byName.get(key);
    const tareKg = container?.tareKg ?? 0;
    const contentsKg = roundKg(row.contentsKg);
    const totalKg = roundKg(contentsKg + tareKg);
    vessels.push({
      vessel: container?.name ?? row.display,
      contentsKg,
      tareKg,
      totalKg,
      limitKg: container?.limitKg ?? null,
      notes: container?.description ?? null,
      group: container?.vesselGroup ?? null,
      overLimit: container?.limitKg != null && totalKg > container.limitKg,
      unknownVessel: !container,
    });
  }
  // Declared packing vessels with nothing in them yet still count their tare.
  const keyed = new Set(vessels.map((v) => v.vessel.trim().toLowerCase()));
  for (const container of containers) {
    if (!container.vesselGroup || keyed.has(container.name.trim().toLowerCase())) continue;
    const tareKg = container.tareKg ?? 0;
    vessels.push({
      vessel: container.name,
      contentsKg: 0,
      tareKg,
      totalKg: roundKg(tareKg),
      limitKg: container.limitKg,
      notes: container.description,
      group: container.vesselGroup,
      overLimit: container.limitKg != null && tareKg > container.limitKg,
      unknownVessel: false,
    });
  }
  vessels.sort((a, b) => a.vessel.localeCompare(b.vessel));

  const groupTotals = new Map<
    string,
    { contentsKg: number; tareKg: number; limitKg: number; hasLimit: boolean }
  >();
  for (const vessel of vessels) {
    if (!vessel.group) continue;
    const total = groupTotals.get(vessel.group) ?? {
      contentsKg: 0,
      tareKg: 0,
      limitKg: 0,
      hasLimit: false,
    };
    total.contentsKg += vessel.contentsKg;
    total.tareKg += vessel.tareKg;
    if (vessel.limitKg != null) {
      total.limitKg += vessel.limitKg;
      total.hasLimit = true;
    }
    groupTotals.set(vessel.group, total);
  }
  const groups = [...groupTotals]
    .map(([group, total]) => ({
      group,
      contentsKg: roundKg(total.contentsKg),
      tareKg: roundKg(total.tareKg),
      totalKg: roundKg(total.contentsKg + total.tareKg),
      limitKg: roundKg(total.limitKg),
      overLimit:
        total.hasLimit && roundKg(total.contentsKg + total.tareKg) > roundKg(total.limitKg),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));

  return {
    vessels,
    groups,
    unassigned: { count: unassignedCount, weightKg: roundKg(unassignedKg) },
  };
}

export const updatePossessionOrNull = (userId: string, id: string, input: PossessionUpdateInput) =>
  orNull('Possession not found', () => updatePossession(userId, id, input));

export type UpsertInput = PossessionCreateInput & { externalId: string };
export interface UpsertResult {
  id: string;
  created: boolean;
}

// The migration primitive: create-or-update keyed on externalId, so re-running an import
// updates rows in place instead of duplicating them. A no-change re-run emits no event, so
// the idempotency check (re-import creates nothing new) leaves history untouched too.
export async function upsertPossession(userId: string, input: UpsertInput): Promise<UpsertResult> {
  return runInTransaction(async (trx) => {
    const existing = await PossessionRepository.getByExternalId(trx, userId, input.externalId);
    const saved = await PossessionRepository.upsertByExternalId(trx, userId, input);
    if (existing === null) {
      await PossessionRepository.recordEvent(trx, userId, saved.id, 'created', {
        after: definedFields(input),
      });
      return { id: saved.id, created: true };
    }
    const diff = changedFields(existing, saved, Object.keys(input));
    if (Object.keys(diff).length > 0) {
      await PossessionRepository.recordEvent(
        trx,
        userId,
        saved.id,
        classifyUpdate(existing, saved, input),
        diff,
      );
    }
    return { id: saved.id, created: false };
  });
}

export interface BulkUpsertItemResult {
  externalId: string;
  id: string | null;
  created: boolean;
  error: string | null;
}

// Up to 100 items per call. Not atomic: each item succeeds or fails on its own and the
// per-item results say which. A failed item never blocks the rest.
export async function bulkUpsertPossessions(
  userId: string,
  items: UpsertInput[],
): Promise<BulkUpsertItemResult[]> {
  const results: BulkUpsertItemResult[] = [];
  for (const input of items) {
    try {
      const { id, created } = await upsertPossession(userId, input);
      results.push({ externalId: input.externalId, id, created, error: null });
    } catch (error) {
      results.push({
        externalId: input.externalId,
        id: null,
        created: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export type ContainerUpsertInput = ContainerCreateInput & { externalId: string };

export async function upsertContainer(
  userId: string,
  input: ContainerUpsertInput,
): Promise<UpsertResult> {
  return runInTransaction(async (trx) => {
    const existing = await ContainerRepository.getByExternalId(trx, userId, input.externalId);
    const saved = await ContainerRepository.upsertByExternalId(trx, userId, input);
    return { id: saved.id, created: existing === null };
  });
}

export const removePossessionIfExists = async (userId: string, id: string): Promise<boolean> =>
  (await orNull('Possession not found', () => removePossession(userId, id).then(() => true))) ??
  false;

export const searchContainers = (
  userId: string,
  input: ContainerSearchInput,
): Promise<ContainerRecord[]> =>
  ContainerRepository.list(db, userId, {
    limit: input.limit,
    offset: input.offset,
    ...(input.query ? { query: input.query } : {}),
    ...(input.parentContainerId ? { parentContainerId: input.parentContainerId } : {}),
  });

export const getContainerImpact = (userId: string, id: string) =>
  ContainerRepository.impact(db, userId, id);

export const getContainer = (userId: string, id: string): Promise<ContainerRecord | null> =>
  ContainerRepository.get(db, userId, id);

// A container with its direct child containers and the possessions sitting in it.
export async function getContainerContents(userId: string, id: string, limit: number) {
  const container = await ContainerRepository.get(db, userId, id);
  if (!container) return null;
  const [children, possessions, impact] = await Promise.all([
    ContainerRepository.list(db, userId, { parentContainerId: id, limit }),
    PossessionRepository.list(db, { userId, containerId: id, limit }),
    ContainerRepository.impact(db, userId, id),
  ]);
  return {
    container,
    children,
    possessions,
    totalChildren: impact?.childContainers ?? children.length,
    totalPossessions: impact?.possessions ?? possessions.length,
  };
}

export const updateContainerOrNull = (userId: string, id: string, input: ContainerUpdateInput) =>
  orNull('Container not found', () => updateContainer(userId, id, input));

export const removeContainerIfExists = async (userId: string, id: string): Promise<boolean> =>
  (await orNull('Container not found', () => removeContainer(userId, id).then(() => true))) ??
  false;

export const VALIDATION_SEVERITIES = ['error', 'warning'] as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export interface PossessionFinding {
  code: string;
  severity: ValidationSeverity;
  possessionId: string | null;
  externalId: string | null;
  message: string;
}

const RETIRED_STATUSES = new Set(['disposed', 'donated', 'sold']);
const KNOWN_VESSEL_GROUPS = new Set(['cabin', 'checked']);

// The manual sheet-audit replacement (plan §6.6): every finding names the row and the rule.
// Orphan container refs (the CON-036 class) cannot occur here — the database foreign key
// rejects them — so that check lives in the import report (Phase 2) instead.
export async function validatePossessions(userId: string): Promise<PossessionFinding[]> {
  const [graph, items] = await Promise.all([
    loadVesselGraph(userId),
    PossessionRepository.auditables(db, userId),
  ]);
  const findings: PossessionFinding[] = [];
  const at = (possessionId: string, externalId: string | null) => ({
    possessionId,
    externalId,
  });
  for (const item of items) {
    const token = item.moveAction?.trim() || null;
    if (!item.isArchived && !item.containerId && !token) {
      findings.push({
        code: 'unplaced_item',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: 'Live item sits in no container and names no vessel',
      });
    }
    if (!item.isArchived && item.weightKg == null) {
      findings.push({
        code: 'missing_weight',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: 'Live item has no weight, so vessel totals undercount it',
      });
    }
    if (!item.isArchived && token && !graph.byName.has(token.toLowerCase())) {
      findings.push({
        code: 'unknown_vessel',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: `moveAction "${token}" matches no container — a typo would silently mis-sum`,
      });
    }
    if (item.status && RETIRED_STATUSES.has(item.status) && !item.isArchived) {
      findings.push({
        code: 'disposed_not_archived',
        severity: 'error',
        ...at(item.id, item.externalId),
        message: `Status is ${item.status} but the item is not archived`,
      });
    }
    if (item.isArchived && item.containerId) {
      findings.push({
        code: 'archived_in_container',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: 'Archived item still sits in a container',
      });
    }
    if (item.priceCents === 0) {
      findings.push({
        code: 'zero_price',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: 'Price is zero — correct for gifts, suspicious otherwise',
      });
    }
    if (item.priceCents != null && item.currencyCode == null) {
      findings.push({
        code: 'missing_currency',
        severity: 'warning',
        ...at(item.id, item.externalId),
        message: 'Price has no currency, so value rollups skip it',
      });
    }
  }
  for (const container of graph.containers) {
    if (container.vesselGroup && !KNOWN_VESSEL_GROUPS.has(container.vesselGroup)) {
      findings.push({
        code: 'unknown_vessel_group',
        severity: 'warning',
        possessionId: null,
        externalId: container.externalId,
        message: `Container "${container.name}" has vesselGroup "${container.vesselGroup}" (expected cabin or checked)`,
      });
    }
  }
  findings.sort((a, b) =>
    (a.possessionId ?? a.externalId ?? '').localeCompare(b.possessionId ?? b.externalId ?? ''),
  );
  return findings;
}
