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
