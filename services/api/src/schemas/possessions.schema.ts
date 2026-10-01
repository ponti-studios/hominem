import { POSSESSION_STATUSES } from '@hominem/db/possessions';
import { z } from 'zod';

const text = (max = 500) => z.string().trim().max(max).nullable().optional();
const isoDate = z.iso.date().nullable().optional();

const possessionFields = {
  category: text(100),
  subCategory: text(100),
  brand: text(200),
  model: text(200),
  status: z.enum(POSSESSION_STATUSES).nullable().optional(),
  isArchived: z.boolean().optional(),
  acquiredDate: isoDate,
  retiredDate: isoDate,
  priceCents: z.number().int().min(0).nullable().optional(),
  sellPriceCents: z.number().int().min(0).nullable().optional(),
  currencyCode: z.string().trim().length(3).nullable().optional(),
  color: text(100),
  size: text(100),
  serialNumber: text(200),
  placement: text(200),
  url: text(2000),
  notes: text(5000),
  containerId: z.uuid().nullable().optional(),
  metadata: z.record(z.string(), z.json()).optional(),
};

export const possessionCreateSchema = z.object({
  name: z.string().trim().min(1).max(300),
  ...possessionFields,
});

export const possessionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  ...possessionFields,
});

export const possessionListQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => value?.split(',').filter(Boolean) ?? [])
    .pipe(z.array(z.enum(POSSESSION_STATUSES))),
  archived: z.enum(['true', 'false']).optional(),
  containerId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
});

const containerFields = {
  containerType: text(100),
  containerKind: text(100),
  status: z.string().trim().min(1).max(50).optional(),
  parentContainerId: z.uuid().nullable().optional(),
  description: text(2000),
  currentLocation: text(300),
  weightKg: z.number().min(0).nullable().optional(),
  volumeCbm: z.number().min(0).nullable().optional(),
  metadata: z.record(z.string(), z.json()).optional(),
};

export const containerCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ...containerFields,
});
export const containerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ...containerFields,
});

export const possessionIdParamSchema = z.object({ id: z.uuid() });

export type PossessionCreateInput = z.infer<typeof possessionCreateSchema>;
export type PossessionUpdateInput = z.infer<typeof possessionUpdateSchema>;
export type PossessionListQuery = z.infer<typeof possessionListQuerySchema>;
export type ContainerCreateInput = z.infer<typeof containerCreateSchema>;
export type ContainerUpdateInput = z.infer<typeof containerUpdateSchema>;

// MCP-facing schemas. The REST list query above is URL-shaped (comma-separated status, coerced
// limit up to 5000); tools take real arrays and a small cap instead.
const nonEmpty = (data: object) => Object.keys(data).length > 0;
const EMPTY_UPDATE = { message: 'Provide at least one field to update' };

export const possessionSearchInputSchema = z.object({
  status: z.array(z.enum(POSSESSION_STATUSES)).optional(),
  archived: z.boolean().optional(),
  containerId: z.uuid().optional(),
  category: z.string().trim().min(1).max(100).optional(),
  query: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(100),
});

export const containerSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(200).optional(),
  parentContainerId: z.uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

export const possessionMcpUpdateSchema = possessionIdParamSchema.extend({
  data: possessionUpdateSchema.refine(nonEmpty, EMPTY_UPDATE),
});
export const containerMcpUpdateSchema = possessionIdParamSchema.extend({
  data: containerUpdateSchema.refine(nonEmpty, EMPTY_UPDATE),
});

export const possessionMoveSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(50),
  containerId: z.uuid().nullable(),
});
export const containerMoveSchema = possessionIdParamSchema.extend({
  parentContainerId: z.uuid().nullable(),
});

export const possessionRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: z.string().nullable(),
  subCategory: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  status: z.enum(POSSESSION_STATUSES).nullable(),
  isArchived: z.boolean(),
  acquiredDate: z.string().nullable(),
  retiredDate: z.string().nullable(),
  priceCents: z.number().nullable(),
  sellPriceCents: z.number().nullable(),
  currencyCode: z.string().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  serialNumber: z.string().nullable(),
  placement: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  containerId: z.uuid().nullable(),
  externalId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const containerRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  containerType: z.string().nullable(),
  containerKind: z.string().nullable(),
  status: z.string(),
  parentContainerId: z.uuid().nullable(),
  description: z.string().nullable(),
  currentLocation: z.string().nullable(),
  weightKg: z.number().nullable(),
  volumeCbm: z.number().nullable(),
  externalId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  itemCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const possessionSummarySchema = z.object({
  total: z.number(),
  unplaced: z.number(),
  byStatus: z.array(
    z.object({ status: z.enum(POSSESSION_STATUSES).nullable(), count: z.number() }),
  ),
  byCategory: z.array(z.object({ category: z.string().nullable(), count: z.number() })),
  valueByCurrency: z.array(
    z.object({
      currencyCode: z.string().nullable(),
      priceCents: z.number(),
      sellPriceCents: z.number(),
    }),
  ),
});

export type ContainerSearchInput = z.infer<typeof containerSearchInputSchema>;
export type PossessionSearchInput = z.infer<typeof possessionSearchInputSchema>;
