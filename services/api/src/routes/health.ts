import crypto from 'node:crypto';

import type { Database } from '@hominem/db';
import { db } from '@hominem/db';
import { logger } from '@hominem/utils/logger';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { Selectable } from 'kysely';
import * as z from 'zod';

import { NotFoundError, InternalError } from '../errors';
import type { AppEnv } from '../server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HealthRecordRow = Selectable<Database['health_records']>;

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

async function listHealthRecords(filters: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  recordType?: string;
}): Promise<HealthRecordRow[]> {
  let query = db.selectFrom('health_records').selectAll();
  if (filters.userId) query = query.where('user_id', '=', filters.userId);
  if (filters.startDate) query = query.where('recorded_at', '>=', filters.startDate);
  if (filters.endDate) query = query.where('recorded_at', '<=', filters.endDate);
  if (filters.recordType) query = query.where('record_type', '=', filters.recordType);
  return query.execute();
}

async function getHealthRecord(id: string): Promise<HealthRecordRow | null> {
  const result = await db
    .selectFrom('health_records')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  return result ?? null;
}

async function createHealthRecord(
  data: Omit<HealthRecordRow, 'id' | 'created_at'>,
): Promise<HealthRecordRow> {
  return db
    .insertInto('health_records')
    .values({ id: crypto.randomUUID(), created_at: new Date(), ...data })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function updateHealthRecord(
  id: string,
  updates: Partial<Omit<HealthRecordRow, 'id' | 'created_at'>>,
): Promise<HealthRecordRow | null> {
  if (Object.keys(updates).length === 0) return getHealthRecord(id);
  const result = await db
    .updateTable('health_records')
    .set(updates)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
  return result ?? null;
}

async function deleteHealthRecord(id: string): Promise<boolean> {
  const result = await db.deleteFrom('health_records').where('id', '=', id).executeTakeFirst();
  return (result.numDeletedRows ?? 0n) > 0n;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeHealthRecord(record: HealthRecordRow) {
  return {
    ...record,
    recorded_at:
      record.recorded_at instanceof Date
        ? record.recorded_at.toISOString()
        : new Date().toISOString(),
    created_at:
      record.created_at instanceof Date
        ? record.created_at.toISOString()
        : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const healthQuerySchema = z.object({
  userId: z.string().optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  activityType: z.string().optional(),
  detailed: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

const healthDataSchema = z.object({
  userId: z.string(),
  date: z.string(),
  activityType: z.string(),
  duration: z.number(),
  caloriesBurned: z.number(),
  notes: z.string().optional(),
});

const updateHealthDataSchema = z.object({
  date: z.string().optional(),
  activityType: z.string().optional(),
  duration: z.number().optional(),
  caloriesBurned: z.number().optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get('/', zValidator('query', healthQuerySchema), async (c) => {
  try {
    const query = c.req.valid('query');
    const results = await listHealthRecords({
      ...(query.userId !== undefined && { userId: query.userId }),
      ...(query.startDate !== undefined && { startDate: query.startDate }),
      ...(query.endDate !== undefined && { endDate: query.endDate }),
      ...(query.activityType !== undefined && { activityType: query.activityType }),
    });
    const sorted = results.sort(
      (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
    );
    return c.json(sorted.map(serializeHealthRecord));
  } catch (err) {
    logger.error('Error fetching health data', { error: err });
    throw new InternalError('Failed to fetch health data');
  }
});

healthRoutes.get('/:id', async (c) => {
  try {
    const result = await getHealthRecord(c.req.param('id'));
    if (!result) throw new NotFoundError('Health record not found');
    return c.json(serializeHealthRecord(result));
  } catch (err) {
    logger.error('Error fetching health record', { error: err });
    throw new InternalError('Failed to fetch health record');
  }
});

healthRoutes.post('/', zValidator('json', healthDataSchema), async (c) => {
  try {
    const validated = c.req.valid('json');
    const result = await createHealthRecord({
      user_id: validated.userId,
      record_type: validated.activityType,
      recorded_at: new Date(validated.date),
      value: String(validated.duration),
      unit: 'minutes',
      source: null,
      metadata: validated.notes ? { notes: validated.notes } : null,
    });
    return c.json(serializeHealthRecord(result), 201);
  } catch (err) {
    logger.error('Error creating health record', { error: err });
    throw new InternalError('Failed to create health record');
  }
});

healthRoutes.put('/:id', zValidator('json', updateHealthDataSchema), async (c) => {
  try {
    const id = c.req.param('id');
    const validated = c.req.valid('json');
    const updates: Partial<Omit<HealthRecordRow, 'id' | 'created_at'>> = {};
    if (validated.date !== undefined) updates.recorded_at = new Date(validated.date);
    if (validated.activityType !== undefined) updates.record_type = validated.activityType;
    if (validated.duration !== undefined) updates.value = String(validated.duration);
    if (validated.notes !== undefined) updates.metadata = { notes: validated.notes };
    const result = await updateHealthRecord(id, updates);
    if (!result) throw new NotFoundError('Health record not found');
    return c.json(serializeHealthRecord(result));
  } catch (err) {
    logger.error('Error updating health record', { error: err });
    throw new InternalError('Failed to update health record');
  }
});

healthRoutes.delete('/:id', async (c) => {
  try {
    const deleted = await deleteHealthRecord(c.req.param('id'));
    if (!deleted) throw new NotFoundError('Health record not found');
    return c.json({ deleted: true });
  } catch (err) {
    logger.error('Error deleting health record', { error: err });
    throw new InternalError('Failed to delete health record');
  }
});
