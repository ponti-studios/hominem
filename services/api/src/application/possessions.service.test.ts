import { db, pool } from '@hominem/db/core';
import { NotFoundError, ValidationError } from '@hominem/db/errors';
import { ContainerRepository } from '@hominem/db/possessions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  bulkUpsertPossessions,
  createContainer,
  createPossession,
  getPossessionHistory,
  listContainers,
  listPossessions,
  movePossessions,
  removeContainer,
  removePossession,
  updateContainer,
  updatePossession,
  upsertContainer,
  upsertPossession,
  validatePossessions,
  vesselWeightReport,
} from './possessions.service';

const alice = 'd4000001-0000-4000-8000-000000000001';
const bob = 'd4000001-0000-4000-8000-000000000002';
const noQuery = { status: [] };

async function seedUser(id: string) {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [id, 'Possessions Test User', `${id}@test.hominem.dev`, true],
  );
}

beforeAll(async () => {
  await seedUser(alice);
  await seedUser(bob);
});

afterAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [[alice, bob]]);
});

describe('possessions', () => {
  it('creates, lists, updates and removes a possession', async () => {
    const created = await createPossession(alice, {
      name: 'Lamp',
      status: 'ordered',
      priceCents: 4599,
      currencyCode: 'GBP',
    });
    expect(created).toMatchObject({
      name: 'Lamp',
      status: 'ordered',
      priceCents: 4599,
      isArchived: false,
    });

    const updated = await updatePossession(alice, created.id, {
      status: 'owned',
      notes: 'By the bed',
    });
    expect(updated).toMatchObject({
      status: 'owned',
      notes: 'By the bed',
      name: 'Lamp',
      priceCents: 4599,
    });

    const owned = await listPossessions(alice, { status: ['owned'] });
    expect(owned.map((p) => p.id)).toContain(created.id);
    expect((await listPossessions(alice, { status: ['wishlist'] })).map((p) => p.id)).not.toContain(
      created.id,
    );

    await removePossession(alice, created.id);
    expect((await listPossessions(alice, noQuery)).map((p) => p.id)).not.toContain(created.id);
  });

  it('merges metadata on update instead of replacing it', async () => {
    const created = await createPossession(alice, {
      name: 'Camera',
      metadata: { orderNumber: '1', weightKg: 2 },
    });
    const updated = await updatePossession(alice, created.id, { metadata: { vendor: 'Shop' } });
    expect(updated.metadata).toEqual({ orderNumber: '1', weightKg: 2, vendor: 'Shop' });
    await removePossession(alice, created.id);
  });

  it('does not let one user read or change another user’s possession', async () => {
    const created = await createPossession(alice, { name: 'Private thing' });
    expect((await listPossessions(bob, noQuery)).map((p) => p.id)).not.toContain(created.id);
    await expect(updatePossession(bob, created.id, { notes: 'mine now' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(removePossession(bob, created.id)).rejects.toBeInstanceOf(NotFoundError);
    await removePossession(alice, created.id);
  });

  it('answers not found for an id that does not exist', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    await expect(updatePossession(alice, missing, { notes: 'x' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(removePossession(alice, missing)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('round-trips sheet-parity fields and the donated/sold statuses', async () => {
    const created = await createPossession(alice, {
      name: 'Donated Coat',
      status: 'donated',
      weightKg: 1.25,
      volumeCbm: 0.02,
      moveAction: 'send my bag box 1',
      externalId: 'ITM-9998',
      acquisitionType: 'purchased',
      purchaseCurrency: 'USD',
      retirementMethod: 'donated',
      ownershipType: 'functional',
    });
    expect(created).toMatchObject({
      status: 'donated',
      weightKg: 1.25,
      moveAction: 'send my bag box 1',
      externalId: 'ITM-9998',
      acquisitionType: 'purchased',
    });
    const updated = await updatePossession(alice, created.id, { status: 'sold' });
    expect(updated.status).toBe('sold');
    await removePossession(alice, created.id);
  });
});

describe('upserts', () => {
  it('creates then updates the same row by externalId without duplicating', async () => {
    const first = await upsertPossession(alice, { externalId: 'ITM-U1', name: 'Vase' });
    expect(first.created).toBe(true);
    const second = await upsertPossession(alice, {
      externalId: 'ITM-U1',
      name: 'Vase',
      weightKg: 2.5,
    });
    expect(second).toMatchObject({ id: first.id, created: false });
    expect(
      (await listPossessions(alice, noQuery)).filter((p) => p.externalId === 'ITM-U1'),
    ).toHaveLength(1);
    await removePossession(alice, first.id);
  });

  it('bulk upserts with per-item results and partial success', async () => {
    const result = await bulkUpsertPossessions(alice, [
      { externalId: 'ITM-B1', name: 'One' },
      { externalId: 'ITM-B2', name: 'Two', moveAction: 'send my bag box 1' },
      {
        externalId: 'ITM-B3',
        name: 'Broken',
        containerId: '00000000-0000-4000-8000-000000000000',
      },
    ]);
    expect(result.filter((r) => r.error === null)).toHaveLength(2);
    const broken = result.find((r) => r.externalId === 'ITM-B3')!;
    expect(broken.error).toMatch(/container/i);
    expect(broken.id).toBeNull();
    for (const row of result) {
      if (row.id) await removePossession(alice, row.id);
    }
  });

  it('upserts a container by externalId', async () => {
    const first = await upsertContainer(alice, { externalId: 'CON-U1', name: 'Crate' });
    expect(first.created).toBe(true);
    const second = await upsertContainer(alice, {
      externalId: 'CON-U1',
      name: 'Crate',
      trackingReference: 'T-1',
    });
    expect(second).toMatchObject({ id: first.id, created: false });
    await removeContainer(alice, first.id);
  });
});

describe('history', () => {
  it('records created, status_changed, moved, and archived events in order', async () => {
    const box = await createContainer(alice, { name: 'History box' });
    const item = await createPossession(alice, { name: 'Heirloom', status: 'owned' });
    await updatePossession(alice, item.id, { status: 'in_use' });
    await movePossessions(alice, [item.id], box.id);
    await updatePossession(alice, item.id, { isArchived: true });

    const history = await getPossessionHistory(alice, item.id, 50);
    expect(history.map((e) => e.kind)).toEqual(['archived', 'moved', 'status_changed', 'created']);
    expect(history[0]).toMatchObject({ possessionId: item.id, actor: alice });
    await removePossession(alice, item.id);
    await removeContainer(alice, box.id);
  });

  it('isolates history by owner', async () => {
    const item = await createPossession(alice, { name: 'Private history' });
    expect(await getPossessionHistory(bob, item.id, 50)).toEqual([]);
    await removePossession(alice, item.id);
  });
});

describe('vessel weights', () => {
  it('rolls item weights up to vessels by moveAction and container nesting', async () => {
    const box = await createContainer(alice, {
      name: 'Report Box 1',
      tareKg: 2,
      limitKg: 30,
      vesselGroup: 'checked',
    });
    const pouch = await createContainer(alice, { name: 'Inner pouch', parentContainerId: box.id });
    const a = await createPossession(alice, {
      name: 'Weight A',
      weightKg: 1.25,
      moveAction: 'report box 1',
    });
    const b = await createPossession(alice, {
      name: 'Weight B',
      weightKg: 0.5,
      containerId: pouch.id,
    });
    const ghost = await createPossession(alice, {
      name: 'Ghost',
      weightKg: 0.1,
      moveAction: 'no_such_bag',
    });
    const archived = await createPossession(alice, {
      name: 'Gone',
      weightKg: 9,
      moveAction: 'report box 1',
      status: 'disposed',
      isArchived: true,
    });

    const report = await vesselWeightReport(alice);
    const vessel = report.vessels.find((v) => v.vessel === 'Report Box 1')!;
    expect(vessel).toMatchObject({
      contentsKg: 1.75,
      tareKg: 2,
      totalKg: 3.75,
      limitKg: 30,
      overLimit: false,
      unknownVessel: false,
    });
    const ghostRow = report.vessels.find((v) => v.vessel === 'no_such_bag')!;
    expect(ghostRow).toMatchObject({ contentsKg: 0.1, unknownVessel: true });
    expect(report.vessels.some((v) => v.contentsKg === 9)).toBe(false);
    expect(report.unassigned.count).toBe(0);

    for (const item of [a, b, ghost, archived]) await removePossession(alice, item.id);
    await removeContainer(alice, pouch.id);
    await removeContainer(alice, box.id);
  });
});

describe('validate', () => {
  it('flags unplaced, weightless, ghost-vessel, lifecycle, and pricing issues', async () => {
    const box = await createContainer(alice, { name: 'Validate box' });
    const stray = await createPossession(alice, { name: 'Stray', status: 'owned', priceCents: 0 });
    const ghost = await createPossession(alice, {
      name: 'Ghost item',
      status: 'owned',
      weightKg: 0.2,
      moveAction: 'ghost_bag_xyz',
    });
    const boxed = await createPossession(alice, {
      name: 'Boxed debt',
      status: 'owned',
      weightKg: 1,
      containerId: box.id,
    });
    const retired = await createPossession(alice, {
      name: 'Retired boxed',
      status: 'disposed',
      weightKg: 1,
      containerId: box.id,
      isArchived: true,
    });
    const loose = await createPossession(alice, {
      name: 'Loose end',
      status: 'disposed',
      weightKg: 1,
    });

    const codes = (await validatePossessions(alice))
      .filter((f) => [stray, ghost, boxed, retired, loose].some((p) => p.id === f.possessionId))
      .map((f) => f.code)
      .sort();
    expect(codes).toContain('unplaced_item');
    expect(codes).toContain('missing_weight');
    expect(codes).toContain('unknown_vessel');
    expect(codes).toContain('archived_in_container');
    expect(codes).toContain('disposed_not_archived');
    expect(codes).toContain('zero_price');
    expect(codes).toContain('missing_currency');
    expect(
      (await validatePossessions(bob)).some((f) =>
        [stray, ghost, boxed, retired, loose].some((p) => p.id === f.possessionId),
      ),
    ).toBe(false);

    for (const item of [stray, ghost, boxed, retired, loose])
      await removePossession(alice, item.id);
    await removeContainer(alice, box.id);
  });
});

describe('containers', () => {
  it('nests containers, counts items, and detaches items when a container is deleted', async () => {
    const case1 = await createContainer(alice, { name: 'Suitcase', weightKg: 4.5 });
    const pouch = await createContainer(alice, { name: 'Pouch', parentContainerId: case1.id });
    const item = await createPossession(alice, { name: 'Charger', containerId: pouch.id });

    const listed = await listContainers(alice);
    expect(listed.find((c) => c.id === pouch.id)).toMatchObject({
      parentContainerId: case1.id,
      itemCount: 1,
    });
    expect(listed.find((c) => c.id === case1.id)).toMatchObject({ weightKg: 4.5, itemCount: 0 });

    await removeContainer(alice, pouch.id);
    const [after] = await listPossessions(alice, { status: [], containerId: undefined }).then(
      (all) => all.filter((p) => p.id === item.id),
    );
    expect(after?.containerId).toBeNull();

    await removePossession(alice, item.id);
    await removeContainer(alice, case1.id);
  });

  it('merges container metadata on update', async () => {
    const box = await createContainer(alice, { name: 'Box', metadata: { sourceItemId: 'ITM-1' } });
    const updated = await updateContainer(alice, box.id, {
      metadata: { trackingReference: 'T-9' },
      description: 'Keepsakes',
    });
    expect(updated.metadata).toEqual({ sourceItemId: 'ITM-1', trackingReference: 'T-9' });
    expect(updated.description).toBe('Keepsakes');
    await removeContainer(alice, box.id);
  });

  it('round-trips vessel config and tracking references', async () => {
    const vessel = await createContainer(alice, {
      name: 'Send My Bag Box 1',
      externalId: 'CON-9999',
      trackingReference: 'SMB-123',
      tareKg: 2.1,
      limitKg: 30,
    });
    expect(vessel).toMatchObject({
      trackingReference: 'SMB-123',
      tareKg: 2.1,
      limitKg: 30,
      externalId: 'CON-9999',
    });
    await removeContainer(alice, vessel.id);
  });

  it('rejects a container that would sit inside itself or its own contents', async () => {
    const a = await createContainer(alice, { name: 'A' });
    const b = await createContainer(alice, { name: 'B', parentContainerId: a.id });
    const c = await createContainer(alice, { name: 'C', parentContainerId: b.id });

    await expect(updateContainer(alice, a.id, { parentContainerId: a.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(updateContainer(alice, a.id, { parentContainerId: b.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(updateContainer(alice, a.id, { parentContainerId: c.id })).rejects.toBeInstanceOf(
      ValidationError,
    );
    // Moving a leaf elsewhere is fine.
    await expect(updateContainer(alice, c.id, { parentContainerId: a.id })).resolves.toMatchObject({
      parentContainerId: a.id,
    });

    for (const container of [c, b, a]) await removeContainer(alice, container.id);
  });

  it('cannot be tricked into a cycle by two simultaneous moves', async () => {
    // Without serialising hierarchy changes both checks pass on the pre-update graph and both commit.
    for (let round = 0; round < 10; round += 1) {
      const a = await createContainer(alice, { name: `RaceA-${round}` });
      const b = await createContainer(alice, { name: `RaceB-${round}` });
      const results = await Promise.allSettled([
        updateContainer(alice, a.id, { parentContainerId: b.id }),
        updateContainer(alice, b.id, { parentContainerId: a.id }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const [rejected] = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected!.reason).toBeInstanceOf(ValidationError);
      for (const container of [a, b]) await removeContainer(alice, container.id);
    }
  });

  it('will not use another user’s container as a parent or as an item’s container', async () => {
    const theirs = await createContainer(bob, { name: 'Bob’s bag' });
    await expect(
      createContainer(alice, { name: 'Sneaky', parentContainerId: theirs.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createPossession(alice, { name: 'Sneaky item', containerId: theirs.id }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const mine = await createPossession(alice, { name: 'Mine' });
    await expect(
      updatePossession(alice, mine.id, { containerId: theirs.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateContainer(bob, theirs.id, {
        parentContainerId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect((await listContainers(alice)).map((c) => c.id)).not.toContain(theirs.id);

    await removePossession(alice, mine.id);
    await removeContainer(bob, theirs.id);
  });

  it('refuses cycles at the database, whatever code path writes them', async () => {
    const a = await createContainer(alice, { name: 'DbA' });
    const b = await createContainer(alice, { name: 'DbB', parentContainerId: a.id });
    const c = await createContainer(alice, { name: 'DbC', parentContainerId: b.id });

    // Raw SQL skips the repository entirely.
    await expect(
      pool.query(`UPDATE app.possession_containers SET parent_container_id = $1 WHERE id = $1`, [
        a.id,
      ]),
    ).rejects.toThrow(/own parent|nested inside itself/i);
    await expect(
      pool.query(`UPDATE app.possession_containers SET parent_container_id = $2 WHERE id = $1`, [
        a.id,
        c.id,
      ]),
    ).rejects.toThrow(/nested inside itself/i);
    // A client-supplied id lets an INSERT point at itself too.
    await expect(
      pool.query(
        `INSERT INTO app.possession_containers (id, owner_userId, name, parent_container_id)
         VALUES ($1, $2, 'self', $1)`,
        ['d4000001-0000-4000-8000-0000000000aa', alice],
      ),
    ).rejects.toThrow();

    // Deleting a middle container re-roots its child, after which the old order is legal.
    await removeContainer(alice, b.id);
    await expect(updateContainer(alice, a.id, { parentContainerId: c.id })).resolves.toMatchObject({
      parentContainerId: c.id,
    });
    for (const container of [a, c]) await removeContainer(alice, container.id);
  });

  it('refuses a cycle introduced through the import upsert', async () => {
    const a = await ContainerRepository.upsertByExternalId(db, alice, {
      name: 'ImpA',
      externalId: 'CON-CYCLE-A',
    });
    const b = await ContainerRepository.upsertByExternalId(db, alice, {
      name: 'ImpB',
      externalId: 'CON-CYCLE-B',
      parentContainerId: a.id,
    });
    await expect(
      ContainerRepository.upsertByExternalId(db, alice, {
        name: 'ImpA',
        externalId: 'CON-CYCLE-A',
        parentContainerId: b.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    for (const container of [b, a]) await removeContainer(alice, container.id);
  });

  it('is enforced by the database too, not only by the service', async () => {
    const theirs = await createContainer(bob, { name: 'Bob’s crate' });
    await expect(
      pool.query(
        `INSERT INTO app.possessions (owner_userId, name, container_id) VALUES ($1, 'x', $2)`,
        [alice, theirs.id],
      ),
    ).rejects.toThrow(/foreign key/i);
    await expect(
      pool.query(
        `INSERT INTO app.possession_containers (owner_userId, name, parent_container_id) VALUES ($1, 'x', $2)`,
        [alice, theirs.id],
      ),
    ).rejects.toThrow(/foreign key/i);
    await removeContainer(bob, theirs.id);
  });
});
