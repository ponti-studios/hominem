import { pool } from '@hominem/db/core';
import { NotFoundError, ValidationError } from '@hominem/db/errors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createContainer,
  createPossession,
  listContainers,
  listPossessions,
  removeContainer,
  removePossession,
  updateContainer,
  updatePossession,
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
