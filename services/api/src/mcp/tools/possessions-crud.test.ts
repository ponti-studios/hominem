import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import './possessions';
import { callTool, type McpToolResult } from '../tool-registry';

const alice = 'e4000001-0000-4000-8000-000000000001';
const bob = 'e4000001-0000-4000-8000-000000000002';

type Possession = { id: string; name: string; containerId: string | null; isArchived: boolean };
type Container = { id: string; name: string; parentContainerId: string | null; itemCount: number };

const content = <T>(result: McpToolResult) => result.structuredContent as T;
const call = async <T>(user: string, tool: string, input: unknown) =>
  content<T>(await callTool(user, tool, input));

async function seedUser(id: string) {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [id, 'Possessions MCP Test User', `${id}@test.hominem.dev`, true],
  );
}

beforeAll(async () => {
  await seedUser(alice);
  await seedUser(bob);
});

afterAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [[alice, bob]]);
});

const newPossession = async (user: string, data: Record<string, unknown>) =>
  (await call<{ possession: Possession }>(user, 'possession_create', data)).possession;
const newContainer = async (user: string, data: Record<string, unknown>) =>
  (await call<{ container: Container }>(user, 'container_create', data)).container;

describe('possessions', () => {
  it('round-trips create -> list -> get -> update -> delete', async () => {
    const created = await newPossession(alice, {
      name: 'Standing desk',
      brand: 'Uplift',
      status: 'owned',
      priceCents: 60000,
      currencyCode: 'USD',
    });

    const listed = await call<{ possessions: Possession[] }>(alice, 'possession_list', {});
    expect(listed.possessions.some((p) => p.id === created.id)).toBe(true);

    const got = await call<{ possession: Possession | null }>(alice, 'possession_get', {
      id: created.id,
    });
    expect(got.possession?.name).toBe('Standing desk');

    const updated = await call<{ possession: Possession | null }>(alice, 'possession_update', {
      id: created.id,
      data: { isArchived: true, metadata: { warranty: '5y' } },
    });
    expect(updated.possession?.isArchived).toBe(true);

    const deleted = await call<{ removed: boolean }>(alice, 'possession_delete', {
      id: created.id,
    });
    expect(deleted.removed).toBe(true);
    expect(
      (await call<{ possession: unknown }>(alice, 'possession_get', { id: created.id })).possession,
    ).toBeNull();
  });

  it('filters by text query, category, status and container', async () => {
    const box = await newContainer(alice, { name: 'Filter box' });
    const a = await newPossession(alice, {
      name: 'Kettle',
      brand: 'Fellow',
      category: 'Kitchen',
      status: 'wishlist',
      containerId: box.id,
    });
    await newPossession(alice, { name: 'Sofa', category: 'Living', status: 'owned' });

    const byBrand = await call<{ possessions: Possession[] }>(alice, 'possession_list', {
      query: 'fellow',
    });
    expect(byBrand.possessions.map((p) => p.id)).toEqual([a.id]);

    const byCategory = await call<{ possessions: Possession[] }>(alice, 'possession_list', {
      category: 'Kitchen',
      status: ['wishlist'],
      containerId: box.id,
    });
    expect(byCategory.possessions.map((p) => p.id)).toEqual([a.id]);

    // LIKE wildcards in the query are literal.
    const wildcard = await call<{ possessions: Possession[] }>(alice, 'possession_list', {
      query: '%',
    });
    expect(wildcard.possessions).toEqual([]);
  });

  it('pages possession_list with offset', async () => {
    const box = await newContainer(alice, { name: 'Offset box' });
    const made = [];
    for (const n of [1, 2, 3])
      made.push(await newPossession(alice, { name: `Off ${n}`, containerId: box.id }));
    const ids = async (offset: number) =>
      (
        await call<{ possessions: Possession[] }>(alice, 'possession_list', {
          containerId: box.id,
          limit: 2,
          offset,
        })
      ).possessions.map((p) => p.id);
    const all = [...(await ids(0)), ...(await ids(2))];
    expect(all.sort()).toEqual(made.map((p) => p.id).sort());
    expect(await ids(3)).toEqual([]);
  });

  it('bounds the list limit', async () => {
    await expect(callTool(alice, 'possession_list', { limit: 101 })).rejects.toThrow();
    const one = await call<{ possessions: Possession[] }>(alice, 'possession_list', { limit: 1 });
    expect(one.possessions.length).toBeLessThanOrEqual(1);
  });

  it('rejects an empty update and an unowned container reference', async () => {
    const p = await newPossession(alice, { name: 'Empty update target' });
    await expect(callTool(alice, 'possession_update', { id: p.id, data: {} })).rejects.toThrow();

    const bobBox = await newContainer(bob, { name: 'Bob box' });
    await expect(
      callTool(alice, 'possession_create', { name: 'Sneaky', containerId: bobBox.id }),
    ).rejects.toThrow();
    await expect(
      callTool(alice, 'possession_update', { id: p.id, data: { containerId: bobBox.id } }),
    ).rejects.toThrow();
  });

  it('isolates users on get, update, move and delete', async () => {
    const mine = await newPossession(alice, { name: 'Alice only' });

    expect(
      (await call<{ possession: unknown }>(bob, 'possession_get', { id: mine.id })).possession,
    ).toBeNull();
    expect(
      (
        await call<{ possession: unknown }>(bob, 'possession_update', {
          id: mine.id,
          data: { name: 'Hijacked' },
        })
      ).possession,
    ).toBeNull();
    expect(
      (await call<{ removed: boolean }>(bob, 'possession_delete', { id: mine.id })).removed,
    ).toBe(false);

    const bobBox = await newContainer(bob, { name: 'Bob isolation box' });
    const moved = await call<{ moved: string[]; missing: string[] }>(bob, 'possession_move', {
      ids: [mine.id],
      containerId: bobBox.id,
    });
    expect(moved).toEqual({ moved: [], missing: [mine.id] });

    const after = await call<{ possession: Possession }>(alice, 'possession_get', { id: mine.id });
    expect(after.possession).toMatchObject({ name: 'Alice only', containerId: null });
  });

  it('moves many possessions in and out of a container', async () => {
    const box = await newContainer(alice, { name: 'Move box' });
    const a = await newPossession(alice, { name: 'Move A' });
    const b = await newPossession(alice, { name: 'Move B' });
    const ghost = 'e4000001-0000-4000-8000-0000000000ff';

    const into = await call<{ moved: string[]; missing: string[] }>(alice, 'possession_move', {
      ids: [a.id, b.id, ghost],
      containerId: box.id,
    });
    expect(into.moved.sort()).toEqual([a.id, b.id].sort());
    expect(into.missing).toEqual([ghost]);

    const out = await call<{ moved: string[] }>(alice, 'possession_move', {
      ids: [a.id],
      containerId: null,
    });
    expect(out.moved).toEqual([a.id]);
    const contents = await call<{ possessions: Possession[] }>(alice, 'container_get', {
      id: box.id,
    });
    expect(contents.possessions.map((p) => p.id)).toEqual([b.id]);
  });

  it('summarizes counts and value per currency, excluding archived items', async () => {
    await seedUser(bob);
    await newPossession(bob, {
      name: 'S1',
      status: 'owned',
      category: 'Tech',
      priceCents: 1000,
      currencyCode: 'USD',
    });
    await newPossession(bob, {
      name: 'S2',
      status: 'owned',
      category: 'Tech',
      priceCents: 500,
      currencyCode: 'USD',
    });
    await newPossession(bob, {
      name: 'S3',
      status: 'wishlist',
      priceCents: 700,
      currencyCode: 'GBP',
    });
    await newPossession(bob, {
      name: 'S4',
      priceCents: 9999,
      currencyCode: 'USD',
      isArchived: true,
    });

    const { summary } = await call<{
      summary: {
        total: number;
        unplaced: number;
        byStatus: Array<{ status: string | null; count: number }>;
        byCategory: Array<{ category: string | null; count: number }>;
        valueByCurrency: Array<{ currencyCode: string | null; priceCents: number }>;
      };
    }>(bob, 'possession_summary', {});
    expect(summary.total).toBe(3);
    expect(summary.unplaced).toBe(3);
    expect(summary.byStatus.find((s) => s.status === 'owned')?.count).toBe(2);
    expect(summary.byCategory.find((c) => c.category === 'Tech')?.count).toBe(2);
    expect(summary.valueByCurrency.find((v) => v.currencyCode === 'USD')?.priceCents).toBe(1500);
    expect(summary.valueByCurrency.find((v) => v.currencyCode === 'GBP')?.priceCents).toBe(700);
  });
});

describe('container discovery and delete preview', () => {
  it('pages, searches and filters container_list beyond the first page', async () => {
    const parent = await newContainer(alice, { name: 'Zz paging parent' });
    const kids = [];
    for (const n of [1, 2, 3]) {
      kids.push(
        await newContainer(alice, { name: `Zz paging kid ${n}`, parentContainerId: parent.id }),
      );
    }
    const page1 = await call<{ containers: Container[] }>(alice, 'container_list', {
      parentContainerId: parent.id,
      limit: 2,
    });
    const page2 = await call<{ containers: Container[] }>(alice, 'container_list', {
      parentContainerId: parent.id,
      limit: 2,
      offset: 2,
    });
    expect([...page1.containers, ...page2.containers].map((c) => c.id)).toEqual(
      kids.map((c) => c.id),
    );
    const byName = await call<{ containers: Container[] }>(alice, 'container_list', {
      query: 'paging kid 3',
    });
    expect(byName.containers.map((c) => c.id)).toEqual([kids[2]!.id]);
  });

  it('counts archived items and child containers in the delete impact', async () => {
    const box = await newContainer(alice, { name: 'Impact box' });
    await newContainer(alice, { name: 'Impact child', parentContainerId: box.id });
    await newPossession(alice, { name: 'Archived thing', containerId: box.id, isArchived: true });
    const { getContainerImpact } = await import('../../application/possessions.service');
    expect(await getContainerImpact(alice, box.id)).toEqual({ possessions: 1, childContainers: 1 });
    expect(await getContainerImpact(bob, box.id)).toBeNull();
  });

  it('bounds the summary currency list', async () => {
    const codes = Array.from(
      { length: 25 },
      (_, i) =>
        `X${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
    );
    for (const code of codes) {
      await newPossession(bob, { name: `Cur ${code}`, priceCents: 1, currencyCode: code });
    }
    const { summary } = await call<{
      summary: { valueByCurrency: unknown[]; currenciesOmitted: number };
    }>(bob, 'possession_summary', {});
    expect(summary.valueByCurrency.length).toBe(20);
    expect(summary.currenciesOmitted).toBeGreaterThanOrEqual(5);
  });
});

describe('containers', () => {
  it('nests containers and reports contents and item counts', async () => {
    const room = await newContainer(alice, { name: 'Office' });
    const shelf = await newContainer(alice, { name: 'Shelf', parentContainerId: room.id });
    await newPossession(alice, { name: 'Book', containerId: shelf.id });

    const roomView = await call<{
      container: Container | null;
      children: Container[];
      possessions: Possession[];
    }>(alice, 'container_get', { id: room.id });
    expect(roomView.children.map((c) => c.id)).toEqual([shelf.id]);
    expect(roomView.possessions).toEqual([]);
    expect(roomView).toMatchObject({ totalChildren: 1, totalPossessions: 0 });

    const listed = await call<{ containers: Container[] }>(alice, 'container_list', {});
    expect(listed.containers.find((c) => c.id === shelf.id)).toMatchObject({
      parentContainerId: room.id,
      itemCount: 1,
    });
  });

  it('rejects cycles and foreign parents on move', async () => {
    const outer = await newContainer(alice, { name: 'Outer' });
    const inner = await newContainer(alice, { name: 'Inner', parentContainerId: outer.id });

    await expect(
      callTool(alice, 'container_move', { id: outer.id, parentContainerId: inner.id }),
    ).rejects.toThrow();
    await expect(
      callTool(alice, 'container_move', { id: outer.id, parentContainerId: outer.id }),
    ).rejects.toThrow();

    const bobBox = await newContainer(bob, { name: 'Bob parent' });
    await expect(
      callTool(alice, 'container_move', { id: inner.id, parentContainerId: bobBox.id }),
    ).rejects.toThrow();

    const top = await call<{ container: Container | null }>(alice, 'container_move', {
      id: inner.id,
      parentContainerId: null,
    });
    expect(top.container?.parentContainerId).toBeNull();
  });

  it('isolates users and rejects an empty update', async () => {
    const box = await newContainer(alice, { name: 'Alice container' });
    expect(
      (await call<{ container: unknown }>(bob, 'container_get', { id: box.id })).container,
    ).toBeNull();
    expect(
      (
        await call<{ container: unknown }>(bob, 'container_update', {
          id: box.id,
          data: { name: 'Hijacked' },
        })
      ).container,
    ).toBeNull();
    expect(
      (await call<{ removed: boolean }>(bob, 'container_delete', { id: box.id })).removed,
    ).toBe(false);
    await expect(callTool(alice, 'container_update', { id: box.id, data: {} })).rejects.toThrow();
  });

  it('orphans contents instead of deleting them', async () => {
    const parent = await newContainer(alice, { name: 'Doomed parent' });
    const child = await newContainer(alice, {
      name: 'Survivor child',
      parentContainerId: parent.id,
    });
    const item = await newPossession(alice, { name: 'Survivor item', containerId: parent.id });

    const deleted = await call<{ removed: boolean }>(alice, 'container_delete', { id: parent.id });
    expect(deleted.removed).toBe(true);
    expect(
      (await call<{ removed: boolean }>(alice, 'container_delete', { id: parent.id })).removed,
    ).toBe(false);

    const survivor = await call<{ possession: Possession }>(alice, 'possession_get', {
      id: item.id,
    });
    expect(survivor.possession.containerId).toBeNull();
    const childView = await call<{ container: Container }>(alice, 'container_get', {
      id: child.id,
    });
    expect(childView.container.parentContainerId).toBeNull();
  });
});
