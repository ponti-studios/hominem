import { sql, type Selectable, type Updateable } from 'kysely';

import { NotFoundError, ValidationError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppPossessionContainers, AppPossessions, Json } from '../../types/database';

type PossessionRow = Selectable<AppPossessions>;
type ContainerRow = Selectable<AppPossessionContainers>;

export const POSSESSION_STATUSES = [
  'wishlist',
  'planned',
  'ordered',
  'delivered',
  'owned',
  'in_use',
  'retired',
  'disposed',
] as const;
export type PossessionStatus = (typeof POSSESSION_STATUSES)[number];

export interface PossessionRecord {
  id: string;
  name: string;
  category: string | null;
  subCategory: string | null;
  brand: string | null;
  model: string | null;
  status: PossessionStatus | null;
  isArchived: boolean;
  acquiredDate: string | null;
  retiredDate: string | null;
  priceCents: number | null;
  sellPriceCents: number | null;
  currencyCode: string | null;
  color: string | null;
  size: string | null;
  serialNumber: string | null;
  placement: string | null;
  url: string | null;
  notes: string | null;
  containerId: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContainerRecord {
  id: string;
  name: string;
  containerType: string | null;
  containerKind: string | null;
  status: string;
  parentContainerId: string | null;
  description: string | null;
  currentLocation: string | null;
  weightKg: number | null;
  volumeCbm: number | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PossessionInput {
  name: string;
  category?: string | null;
  subCategory?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: PossessionStatus | null;
  isArchived?: boolean;
  acquiredDate?: string | null;
  retiredDate?: string | null;
  priceCents?: number | null;
  sellPriceCents?: number | null;
  currencyCode?: string | null;
  color?: string | null;
  size?: string | null;
  serialNumber?: string | null;
  placement?: string | null;
  url?: string | null;
  notes?: string | null;
  containerId?: string | null;
  externalId?: string | null;
  metadata?: Record<string, Json>;
}

export interface ContainerInput {
  name: string;
  containerType?: string | null;
  containerKind?: string | null;
  status?: string;
  parentContainerId?: string | null;
  description?: string | null;
  currentLocation?: string | null;
  weightKg?: number | null;
  volumeCbm?: number | null;
  externalId?: string | null;
  metadata?: Record<string, Json>;
}

function parseStatus(value: string | null): PossessionStatus | null {
  if (value === null) return null;
  const status = POSSESSION_STATUSES.find((candidate) => candidate === value);
  if (status) return status;
  throw new ValidationError(`Invalid possession status: ${value}`, { status: value });
}

function toObject(value: Json): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

const iso = (value: string | Date) => new Date(value).toISOString();
const numberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

function toPossession(row: PossessionRow): PossessionRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.possessionType,
    subCategory: row.subCategory,
    brand: row.brand,
    model: row.model,
    status: parseStatus(row.status),
    isArchived: row.isArchived,
    acquiredDate: row.acquiredDate,
    retiredDate: row.retiredDate,
    priceCents: row.priceCents,
    sellPriceCents: row.sellPriceCents,
    currencyCode: row.currencyCode,
    color: row.color,
    size: row.size,
    serialNumber: row.serialNumber,
    placement: row.placement,
    url: row.url,
    notes: row.notes,
    containerId: row.containerId,
    externalId: row.externalId,
    metadata: toObject(row.metadata),
    createdAt: iso(row.createdat),
    updatedAt: iso(row.updatedat),
  };
}

function toContainer(row: ContainerRow & { itemCount?: string | number | null }): ContainerRecord {
  return {
    id: row.id,
    name: row.name,
    containerType: row.containerType,
    containerKind: row.containerKind,
    status: row.status,
    parentContainerId: row.parentContainerId,
    description: row.description,
    currentLocation: row.currentLocation,
    weightKg: numberOrNull(row.weightKg),
    volumeCbm: numberOrNull(row.volumeCbm),
    externalId: row.externalId,
    metadata: toObject(row.metadata),
    itemCount: Number(row.itemCount ?? 0),
    createdAt: iso(row.createdat),
    updatedAt: iso(row.updatedat),
  };
}

// Kysely skips `undefined` values, so a PATCH only touches the keys the caller provided.
function possessionValues(input: Partial<PossessionInput>): Updateable<AppPossessions> {
  return {
    name: input.name,
    possessionType: input.category,
    subCategory: input.subCategory,
    brand: input.brand,
    model: input.model,
    status: input.status,
    isArchived: input.isArchived,
    acquiredDate: input.acquiredDate,
    retiredDate: input.retiredDate,
    priceCents: input.priceCents,
    sellPriceCents: input.sellPriceCents,
    currencyCode: input.currencyCode,
    color: input.color,
    size: input.size,
    serialNumber: input.serialNumber,
    placement: input.placement,
    url: input.url,
    notes: input.notes,
    containerId: input.containerId,
    externalId: input.externalId,
    metadata: input.metadata,
  };
}

function containerValues(input: Partial<ContainerInput>): Updateable<AppPossessionContainers> {
  return {
    name: input.name,
    containerType: input.containerType,
    containerKind: input.containerKind,
    status: input.status,
    parentContainerId: input.parentContainerId,
    description: input.description,
    currentLocation: input.currentLocation,
    weightKg: input.weightKg,
    volumeCbm: input.volumeCbm,
    externalId: input.externalId,
    metadata: input.metadata,
  };
}

const hasValues = (values: object) => Object.values(values).some((value) => value !== undefined);

export interface ListPossessionsInput {
  userId: string;
  statuses?: PossessionStatus[];
  archived?: boolean;
  containerId?: string;
  limit?: number;
}

export const PossessionRepository = {
  async list(handle: DbHandle, input: ListPossessionsInput): Promise<PossessionRecord[]> {
    let query = handle
      .selectFrom('app.possessions')
      .selectAll()
      .where('ownerUserid', '=', input.userId);
    if (input.statuses?.length) query = query.where('status', 'in', input.statuses);
    if (input.archived !== undefined) query = query.where('isArchived', '=', input.archived);
    if (input.containerId) query = query.where('containerId', '=', input.containerId);
    const rows = await query
      .orderBy('createdat', 'desc')
      .orderBy('id', 'desc')
      .limit(input.limit ?? 1000)
      .execute();
    return rows.map(toPossession);
  },

  async create(
    handle: DbHandle,
    userId: string,
    input: PossessionInput,
  ): Promise<PossessionRecord> {
    const row = await handle
      .insertInto('app.possessions')
      .values({ ...possessionValues(input), name: input.name, ownerUserid: userId })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toPossession(row);
  },

  async update(
    handle: DbHandle,
    userId: string,
    id: string,
    input: Partial<PossessionInput>,
  ): Promise<PossessionRecord> {
    // Metadata is merged, never replaced, so a client that only knows one key can't erase the rest.
    const plain = possessionValues({ ...input, metadata: undefined });
    const merged =
      input.metadata === undefined
        ? {}
        : { metadata: sql<Json>`metadata || ${JSON.stringify(input.metadata)}::jsonb` };
    if (!hasValues(plain) && input.metadata === undefined) {
      const existing = await handle
        .selectFrom('app.possessions')
        .selectAll()
        .where('id', '=', id)
        .where('ownerUserid', '=', userId)
        .executeTakeFirst();
      if (!existing) throw new NotFoundError('Possession');
      return toPossession(existing);
    }
    const row = await handle
      .updateTable('app.possessions')
      .set({ ...plain, ...merged })
      .where('id', '=', id)
      .where('ownerUserid', '=', userId)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundError('Possession');
    return toPossession(row);
  },

  async remove(handle: DbHandle, userId: string, id: string): Promise<void> {
    const result = await handle
      .deleteFrom('app.possessions')
      .where('id', '=', id)
      .where('ownerUserid', '=', userId)
      .executeTakeFirst();
    if (result.numDeletedRows === 0n) throw new NotFoundError('Possession');
  },

  // For imports: same external id updates the row in place, so re-running never duplicates.
  async upsertByExternalId(
    handle: DbHandle,
    userId: string,
    input: PossessionInput & { externalId: string },
  ): Promise<PossessionRecord> {
    const { externalId: _external, ...updates } = possessionValues(input);
    const values = { ...possessionValues(input), name: input.name, ownerUserid: userId };
    const row = await handle
      .insertInto('app.possessions')
      .values(values)
      .onConflict((oc) =>
        oc
          .columns(['ownerUserid', 'externalId'])
          .where('externalId', 'is not', null)
          .doUpdateSet(updates),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toPossession(row);
  },
};

export const ContainerRepository = {
  async list(handle: DbHandle, userId: string): Promise<ContainerRecord[]> {
    const rows = await handle
      .selectFrom('app.possessionContainers as c')
      .selectAll('c')
      .select((eb) =>
        eb
          .selectFrom('app.possessions as p')
          .select(sql<string>`count(*)`.as('n'))
          .whereRef('p.containerId', '=', 'c.id')
          .where('p.isArchived', '=', false)
          .as('itemCount'),
      )
      .where('c.ownerUserid', '=', userId)
      .orderBy('c.name')
      .execute();
    return rows.map(toContainer);
  },

  async create(handle: DbHandle, userId: string, input: ContainerInput): Promise<ContainerRecord> {
    const row = await handle
      .insertInto('app.possessionContainers')
      .values({ ...containerValues(input), name: input.name, ownerUserid: userId })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toContainer(row);
  },

  async update(
    handle: DbHandle,
    userId: string,
    id: string,
    input: Partial<ContainerInput>,
  ): Promise<ContainerRecord> {
    if (input.parentContainerId === id) {
      throw new ValidationError('A container cannot be its own parent');
    }
    const values = containerValues(input);
    const row = await handle
      .updateTable('app.possessionContainers')
      .set(hasValues(values) ? values : { name: sql<string>`name` })
      .where('id', '=', id)
      .where('ownerUserid', '=', userId)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new NotFoundError('Container');
    return toContainer(row);
  },

  async remove(handle: DbHandle, userId: string, id: string): Promise<void> {
    const result = await handle
      .deleteFrom('app.possessionContainers')
      .where('id', '=', id)
      .where('ownerUserid', '=', userId)
      .executeTakeFirst();
    if (result.numDeletedRows === 0n) throw new NotFoundError('Container');
  },

  async upsertByExternalId(
    handle: DbHandle,
    userId: string,
    input: ContainerInput & { externalId: string },
  ): Promise<ContainerRecord> {
    const { externalId: _external, ...updates } = containerValues(input);
    const values = { ...containerValues(input), name: input.name, ownerUserid: userId };
    const row = await handle
      .insertInto('app.possessionContainers')
      .values(values)
      .onConflict((oc) =>
        oc
          .columns(['ownerUserid', 'externalId'])
          .where('externalId', 'is not', null)
          .doUpdateSet(updates),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
    return toContainer(row);
  },
};
