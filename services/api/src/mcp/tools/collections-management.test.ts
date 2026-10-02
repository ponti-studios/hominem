import { db, pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import './collections';
import {
  collectionDetailOutputSchema,
  createCollectionOutputSchema,
  deleteCollectionOutputSchema,
  inviteMemberOutputSchema,
  leaveCollectionOutputSchema,
  removeMemberOutputSchema,
  updateCollectionToolOutputSchema,
  updateMemberRoleToolOutputSchema,
} from '../../schemas/collections.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool, listTools } from '../tool-registry';

const ownerId = 'd3000000-0000-4000-8000-000000000001';
const memberId = 'd3000000-0000-4000-8000-000000000002';
const strangerId = 'd3000000-0000-4000-8000-000000000003';
const userIds = [ownerId, memberId, strangerId];
const emailOf = (id: string) => `${id}@test.hominem.dev`;

async function createCollection(name: string) {
  return toolOutput(
    await callTool(ownerId, 'create_collection', { name }),
    createCollectionOutputSchema,
  ).collection;
}

async function inviteMember(collectionId: string, userId: string, role: 'editor' | 'viewer') {
  return toolOutput(
    await callTool(ownerId, 'invite_member', { collectionId, email: emailOf(userId), role }),
    inviteMemberOutputSchema,
  ).member;
}

async function membersOf(collectionId: string) {
  return toolOutput(
    await callTool(ownerId, 'collection_detail', { collectionId }),
    collectionDetailOutputSchema,
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
    for (const name of [
      'delete_collection',
      'leave_collection',
      'remove_member',
      'decline_collection_invite',
    ]) {
      expect(byName.get(name)).toMatchObject({ destructive: true, requiresConfirmation: true });
    }
    for (const name of ['update_collection', 'update_member_role']) {
      expect(byName.get(name)).toMatchObject({ destructive: false, idempotent: true });
      expect(byName.get(name)?.requiresConfirmation).toBeUndefined();
    }
  });
});

describe('update_collection', () => {
  it('updates fields and clears the description with null', async () => {
    const created = await createCollection('Before');

    const renamed = toolOutput(
      await callTool(ownerId, 'update_collection', {
        collectionId: created.id,
        name: 'After',
        description: 'Now described',
        visibility: 'shared',
      }),
      updateCollectionToolOutputSchema,
    );
    expect(renamed.collection).toMatchObject({
      name: 'After',
      description: 'Now described',
      visibility: 'shared',
    });

    const cleared = toolOutput(
      await callTool(ownerId, 'update_collection', {
        collectionId: created.id,
        description: null,
      }),
      updateCollectionToolOutputSchema,
    );
    expect(cleared.collection).toMatchObject({ name: 'After', description: null });
  });

  it('returns null for a collection the caller does not own', async () => {
    const created = await createCollection('Owner only');

    const result = toolOutput(
      await callTool(strangerId, 'update_collection', { collectionId: created.id, name: 'Nope' }),
      updateCollectionToolOutputSchema,
    );
    expect(result.collection).toBeNull();
  });

  it('rejects a patch with no fields to change', async () => {
    const created = await createCollection('Untouched');

    await expect(
      callTool(ownerId, 'update_collection', { collectionId: created.id }),
    ).rejects.toThrow();
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
      toolOutput(
        await callTool(ownerId, 'delete_collection', { collectionId: created.id }),
        deleteCollectionOutputSchema,
      ),
    ).toEqual({ deleted: true });
    expect(
      toolOutput(
        await callTool(ownerId, 'delete_collection', { collectionId: created.id }),
        deleteCollectionOutputSchema,
      ),
    ).toEqual({ deleted: false });
  });

  it("skips confirmation for and refuses to delete another user's collection", async () => {
    const created = await createCollection('Not yours');

    const tool = listTools().find((candidate) => candidate.name === 'delete_collection');
    expect(await tool?.preview?.(strangerId, { collectionId: created.id })).toBeNull();
    expect(
      toolOutput(
        await callTool(strangerId, 'delete_collection', { collectionId: created.id }),
        deleteCollectionOutputSchema,
      ),
    ).toEqual({ deleted: false });
    expect(await membersOf(created.id)).toHaveLength(1);
  });
});

describe('member management', () => {
  it('changes a role, then removes the member', async () => {
    const created = await createCollection('Team');
    const invited = await inviteMember(created.id, memberId, 'viewer');

    const promoted = toolOutput(
      await callTool(ownerId, 'update_member_role', {
        collectionId: created.id,
        memberId: invited.id,
        role: 'editor',
      }),
      updateMemberRoleToolOutputSchema,
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
      toolOutput(
        await callTool(ownerId, 'remove_member', {
          collectionId: created.id,
          memberId: invited.id,
        }),
        removeMemberOutputSchema,
      ),
    ).toEqual({ removed: true });
    expect(await membersOf(created.id)).toHaveLength(1);
  });

  it('refuses member changes from a non-owner and never touches the owner row', async () => {
    const created = await createCollection('Guarded');
    const invited = await inviteMember(created.id, memberId, 'viewer');
    const ownerRow = (await membersOf(created.id)).find((member) => member.role === 'owner');
    expect(ownerRow).toBeDefined();

    const asMember = toolOutput(
      await callTool(memberId, 'update_member_role', {
        collectionId: created.id,
        memberId: invited.id,
        role: 'editor',
      }),
      updateMemberRoleToolOutputSchema,
    );
    expect(asMember.member).toBeNull();

    expect(
      toolOutput(
        await callTool(memberId, 'remove_member', {
          collectionId: created.id,
          memberId: invited.id,
        }),
        removeMemberOutputSchema,
      ),
    ).toEqual({ removed: false });
    expect(
      toolOutput(
        await callTool(ownerId, 'remove_member', {
          collectionId: created.id,
          memberId: ownerRow?.id,
        }),
        removeMemberOutputSchema,
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
      toolOutput(
        await callTool(ownerId, 'leave_collection', { collectionId: created.id }),
        leaveCollectionOutputSchema,
      ),
    ).toEqual({ left: false });
    expect(
      toolOutput(
        await callTool(memberId, 'leave_collection', { collectionId: created.id }),
        leaveCollectionOutputSchema,
      ),
    ).toEqual({ left: true });
    expect(
      toolOutput(
        await callTool(memberId, 'leave_collection', { collectionId: created.id }),
        leaveCollectionOutputSchema,
      ),
    ).toEqual({ left: false });
  });
});

describe('decline_collection_invite', () => {
  it('declines a pending invite once and reports false afterwards', async () => {
    const created = await createCollection('Unwanted');
    await inviteMember(created.id, memberId, 'viewer');

    const tool = listTools().find((candidate) => candidate.name === 'decline_collection_invite');
    expect(await tool?.preview?.(memberId, { collectionId: created.id })).toEqual({
      collection: 'Unwanted',
      role: 'viewer',
    });

    expect(
      toolOutput(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
        removeMemberOutputSchema,
      ),
    ).toEqual({ removed: true });

    expect(await tool?.preview?.(memberId, { collectionId: created.id })).toBeNull();
    expect(
      toolOutput(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
        removeMemberOutputSchema,
      ),
    ).toEqual({ removed: false });
    expect(await membersOf(created.id)).toHaveLength(1);
  });

  it('previews an older invite even when it falls outside the first 50', async () => {
    const oldInvite = await createCollection('Older invite');
    await inviteMember(oldInvite.id, memberId, 'viewer');

    const newerCollections = await db
      .insertInto('app.collections')
      .values(
        Array.from({ length: 51 }, (_, index) => ({
          ownerUserid: ownerId,
          name: `Newer invite ${index}`,
          createdat: new Date(Date.now() + index * 1000),
          updatedat: new Date(Date.now() + index * 1000),
        })),
      )
      .returning('id')
      .execute();
    await db
      .insertInto('app.collectionMembers')
      .values(
        newerCollections.map((collection, index) => ({
          ownerUserid: ownerId,
          collectionId: collection.id,
          userId: memberId,
          personId: null,
          role: 'viewer',
          invitedAt: new Date(Date.now() + index * 1000 + 10_000),
        })),
      )
      .execute();

    const tool = listTools().find((candidate) => candidate.name === 'decline_collection_invite');
    expect(await tool?.preview?.(memberId, { collectionId: oldInvite.id })).toEqual({
      collection: 'Older invite',
      role: 'viewer',
    });
  });

  it('cannot decline an invite that has already been accepted', async () => {
    const created = await createCollection('Joined');
    await inviteMember(created.id, memberId, 'viewer');
    await callTool(memberId, 'accept_collection_invite', { collectionId: created.id });

    expect(
      toolOutput(
        await callTool(memberId, 'decline_collection_invite', { collectionId: created.id }),
        removeMemberOutputSchema,
      ),
    ).toEqual({ removed: false });
    expect(await membersOf(created.id)).toHaveLength(2);
  });
});
