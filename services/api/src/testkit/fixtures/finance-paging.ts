import type { Hono } from 'hono';
import { expect } from 'vitest';
import { z } from 'zod';

import type { AppContext } from '../../rpc/middleware/auth';

type Params = Record<string, string | string[] | undefined>;

const pageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      userId: z.string(),
      accountId: z.string().uuid(),
      amount: z.number(),
      description: z.string().nullable(),
      postedOn: z.string(),
      merchantName: z.string().nullable(),
      currencyCode: z.string(),
      accountName: z.string(),
      transactionType: z.string(),
      categoryId: z.string().uuid().nullable(),
      categoryName: z.string().nullable(),
      tags: z.array(z.string()),
      notes: z.string().nullable(),
      counterpartId: z.string().uuid().nullable(),
      recurring: z.boolean(),
      pending: z.boolean(),
      excluded: z.boolean(),
      source: z.string().nullable(),
    }),
  ),
  filteredCount: z.number().int(),
  totalUserCount: z.number().int(),
  nextCursor: z.string().nullable(),
});

export type Page = z.infer<typeof pageSchema>;

export function listUrl(params: Params): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  const query = search.toString();
  return `/api/finance/transactions/list${query ? `?${query}` : ''}`;
}

export async function readPage(app: Hono<AppContext>, params: Params = {}): Promise<Page> {
  const res = await app.request(listUrl(params));
  expect(res.status).toBe(200);
  return pageSchema.parse(await res.json());
}

/** Walks a list with `size` rows per page from `from` (or the top), returning the ids in order. */
export async function walk(
  app: Hono<AppContext>,
  params: Params,
  size: number,
  from: string | null = null,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor = from;
  for (let guard = 0; guard < 100; guard++) {
    const page = await readPage(app, {
      ...params,
      limit: String(size),
      cursor: cursor ?? undefined,
    });
    ids.push(...page.data.map((row) => row.id));
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
  }
  throw new Error('paging did not finish');
}

/** Tampers with a real cursor's payload, for the rejection cases. */
export function forgeCursor(cursor: string, patch: Record<string, unknown>): string {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  return Buffer.from(JSON.stringify({ ...payload, ...patch }), 'utf8').toString('base64url');
}

export async function firstCursor(app: Hono<AppContext>, params: Params = {}): Promise<string> {
  const page = await readPage(app, { ...params, limit: '1' });
  if (!page.nextCursor) throw new Error('expected a cursor');
  return page.nextCursor;
}
