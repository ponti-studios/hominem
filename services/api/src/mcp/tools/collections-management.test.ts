import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import './collections';
import { callTool, listTools, type McpToolResult } from '../tool-registry';

const ownerId = 'd3000000-0000-4000-8000-000000000001';
const memberId = 'd3000000-0000-4000-8000-000000000002';
const strangerId = 'd3000000-0000-4000-8000-000000000003';
const userIds = [ownerId, memberId, strangerId];
const emailOf = (id: string) => `${id}@test.hominem.dev`;

type Collection = { id: string; name: string; description: string | null; visibility: string };
type Member = { id: string; userId: string | null; role: string; acceptedAt: string | null };

function payload<T>(result: McpToolResult): T {
  return result.structuredContent as T;
}

async function createCollection(name: string) {
  return payload<{ collection: Collection }>(await callTool(ownerId, 'create_collection', { name }))
    .collection;
}

async function inviteMember(collectionId: string, userId: string, role: 'editor' | 'viewer') {
  return payload<{ member: Member }>(
    await callTool(ownerId, 'invite_member', { collectionId, email: emailOf(userId), role }),
  ).member;
}

async function membersOf(collectionId: string) {
  return payload<{ members: Member[] }>(
    await callTool(ownerId, 'collection_detail', { collectionId }),
  ).members;
}

beforeAll(async () => {
  for (const id of userIds) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, `Collection Mgmt User ${id}`, emailOf(id), true],
    );
  }
});

afterAll(async () => {
  for (const id of userIds) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
});

describe('collection management tool annotations', () => {
  it('marks only the irreversible tools as destructive and confirmed', () => {
    const byName = new Map(listTools().map((tool) => [tool.name, tool]));
    for (const name of ['delete_collection', 'leave_collection', 'remove_member']) {
      expect(byName.get(name)).toMatchObject({ destructive: true, requiresConfirmation: true });
    }
    for (const name of ['update_collection', 'update_member_role', 'decline_collection_invite']) {
      expect(byName.get(name)).toMatchObject({ destructive: false, idempotent: true });
      expect(byName.get(name)?.requiresConfirmation).toBeUndefined();
    }
  });
});

describe('update_collection', () => {
  it('updates fields and clears the description with null', async () => {
    const created = await createCollection('Before');

    const renamed = payload<{ collection: Collection | null }>(
      await callTool(ownerId, 'update_collection', {
        collectionId: created.id,
        name: 'After',
        description: 'Now described',
        visibility: 'shared',
      }),
    );
    expect(renamed.collection).toMatchObject({
      name: 'After',
      description: 'Now described',
      visibility: 'shared',
    });

    const cleared = payload<{ collection: Collection | null }>(
      await callTool(ownerId, 'update_collection', {
        collectionId: created.id,
        description: null,
      }),
    );
    expect(cleared.collection).toMatchObject({ name: 'After', description: null });
  });

  it('returns null for a collection the caller does not own', async () => {
    const created = await createCollection('Owner only');

    const result = payload<{ collection: unknown }>(
      await callTool(strangerId, 'update_collection', { collectionId: created.id, name: 'Nope' }),
    );
    expect(result.collection).toBeNull();
  });
});

describe('delete_collection', () => {
  it('deletes an owned collection and previews what will go', async () => {
    const created = await createCollection('Doomed');
    await inviteMember(created.id, memberId, 'viewer');

    const tool = listTools().find((candidate) => candidate.name === 'delete_collection');
    expect(await tool?.preview?.(ownerId, { collectionId: created.id })).toEqual({
      collection: 'Doomed',
      items: 0,
      members: 2,
    });

    expect(
      payload<{ deleted: boolean }>(
        await callTool(ownerId, 'delete_collection', { collectionId: created.id }),
      ),
    ).toEqual({ deleted: true });
    expect(
      payload<{ deleted: boolean }>(
        await callTool(ownerId, 'delete_collection', { collectionId: created.id }),
      ),
    ).toEqual({ deleted: false });
  });

  it("skips confirmation for and refuses to delete another user's collection", async () => {
    const created = await createCollection('Not yours');

    const tool = listTools().find((candidate) => candidate.name === 'delete_collection');
    expect(await tool?.preview?.(strangerId, { collectionId: created.id })).toBeNull();
    expect(
      payload<{ deleted: boolean }>(
        await callTool(strangerId, 'delete_collection', { collectionId: created.id }),
      ),
    ).toEqual({ deleted: false });
    expect(await membersOf(created.id)).toHaveLength(1);
  });
});

describe('member management', () => {
  it('changes a role, then removes the member', async () => {
    const created = await createCollection('Team');
    const invited = await inviteMember(created.id, memberId, 'viewer');

    const promoted = payload<{ member: Member | null }>(
      await callTool(ownerId, 'update_member_role', {
        collectionId: created.id,
        memberId: invited.id,
        role: 'editor',
      }),
    );
    expect(promoted.member).toMatchObject({ id: invited.id, role: 'editor' });

    const tool = listTools().find((candidate) => candidate.name === 'remove_member');
    expect(
      await tool?.preview?.(ownerId, { collectionId: created.id, memberId: invited.id }),
    ).toEqual({
      collection: 'Team',
      member: emailOf(memberId),
      role: 'editor',
    });

    expect(
      payload<{ removed: boolean }>(
        await callTool(ownerId, 'remove_member', {
          collectionId: created.id,
          memberId: invited.id,
        }),
      ),
    ).toEqual({ removed: true });
    expect(await membersOf(created.id)).toHaveLength(1);
  });

  it('refuses member changes from a non-owner and never touches the owner row', async () => {
    const created = await createCollection('Guarded');
    const invited = await inviteMember(created.id, memberId, 'viewer');
    const ownerRow = (await membersOf(created.id)).find((member) => member.role === 'owner');
    expect(ownerRow).toBeDefined();

    const asMember = payload<{ member: unknown }>(
      await callTool(memberId, 'update_member_role', {
        collectionId: created.id,
        memberId: invited.id,
        role: 'editor',
      }),
    );
    expect(asMember.member).toBeNull();

    expect(
      payload<{ removed: boolean }>(
        await callTool(memberId, 'remove_member', {
          collectionId: created.id,
          memberId: invited.id,
        }),
      ),
    ).toEqual({ removed: false });
    expect(
      payload<{ removed: boolean }>(
        await callTool(ownerId, 'remove_member', {
          collectionId: created.id,
          memberId: ownerRow?.id,
        }),
      ),
    ).toEqual({ removed: false });
    expect(await membersOf(created.id)).toHaveLength(2);
  });
});

describe('leave_collection', () => {
  it('lets a member leave, but reports false for the owner', async () => {
    const created = await createCollection('Leavable');
    await inviteMember(created.id, memberId, 'editor');
    await callTool(memberId, 'accept_collection_invite', { collectionId: created.id });

    const tool = listTools().find((candidate) => candidate.name === 'leave_collection');
    expect(await tool?.preview?.(memberId, { collectionId: created.id })).toEqual({
      collection: 'Leavable',
      yourRole: 'editor',
    });
    expect(await tool?.preview?.(ownerId, { collectionId: created.id })).toBeNull();

    expect(
      payload<{ left: boolean }>(
        await callTool(ownerId, 'leave_collection', { collectionId: created.id }),
      ),
    ).toEqual({ left: false });
    expect(
      payload<{ left: boolean }>(
        await callTool(memberId, 'leave_collection', { collectionId: created.id }),
      ),
    ).toEqual({ left: true });
    expect(
      payload<{ left: boolean }>(
        await callTool(memberId, 'leave_collection', { collectionId: created.id }),
      ),
    ).toEqual({ left: false });
  });
});

describe('decline_collection_invite', () => {
  it('declines a pending invite once and reports false afterwards', async () => {
    const created = await createCollection('Unwanted');
    await inviteMember(created.id, memberId, 'viewer');

    expect(
      payload<{ removed: boolean }>(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
      ),
    ).toEqual({ removed: true });
    expect(
      payload<{ removed: boolean }>(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
      ),
    ).toEqual({ removed: false });
    expect(await membersOf(created.id)).toHaveLength(1);
  });

  it('cannot decline an invite that has already been accepted', async () => {
    const created = await createCollection('Joined');
    await inviteMember(created.id, memberId, 'viewer');
    await callTool(memberId, 'accept_collection_invite', { collectionId: created.id });

    expect(
      payload<{ removed: boolean }>(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
      ),
    ).toEqual({ removed: false });
    expect(await membersOf(created.id)).toHaveLength(2);
  });
});
