import {
  removeUsers,
  resetUsers,
  seedTag,
  seedTagAssignments,
} from '@hominem/finance-services/test/factory';
import { activeEntityIdsForTag, tagById } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool, getToolDefinition } from '../tool-registry';
import './finance';

const userId = 'f20000d0-0000-4000-8000-000000000001';
const otherUserId = 'f20000d0-0000-4000-8000-000000000002';
const entityOne = 'f20000d1-0000-4000-8000-000000000001';
const entityTwo = 'f20000d1-0000-4000-8000-000000000002';

type TagResult = {
  assignmentsMoved?: number;
  assignmentsPreserved?: number;
  tag?: { id: string; name: string } | null;
  reason?: string | null;
};

const content = structuredContent<TagResult>;

const onNotes = { entityTable: 'app.notes', assignmentSource: 'agent' };

beforeAll(() => resetUsers(userId, otherUserId));

afterAll(() => removeUsers(userId, otherUserId));

describe('finance_tag_rename', () => {
  it('renames the display name, keeping the id and every assignment', async () => {
    const { id: tagId } = await seedTag({ ownerUserid: userId, name: 'art' });
    await seedTagAssignments(tagId, [entityOne], onNotes);
    await seedTagAssignments(tagId, [entityTwo], onNotes);

    const result = content(
      await callTool(userId, 'finance_tag_rename', { from: 'art', to: 'Art' }),
    );
    expect(result.reason).toBeNull();
    expect(result.tag).toEqual({ id: tagId, name: 'Art' });
    expect(result.assignmentsMoved).toBe(2);

    const row = await tagById(tagId);
    expect(row?.name).toBe('Art');
    expect(await activeEntityIdsForTag(tagId)).toEqual([entityOne, entityTwo]);
  });

  it('refuses with target_exists when another tag already holds the name', async () => {
    const { id: source } = await seedTag({ ownerUserid: userId, name: 'probe-source' });
    await seedTag({ ownerUserid: userId, name: 'probe-target' });

    const result = content(
      await callTool(userId, 'finance_tag_rename', {
        from: 'probe-source',
        to: 'probe-target',
      }),
    );
    expect(result.reason).toBe('target_exists');
    expect((await tagById(source))?.name).toBe('probe-source');
  });

  it('reports an unknown source tag', async () => {
    const result = content(
      await callTool(userId, 'finance_tag_rename', { from: 'nope', to: 'Nope' }),
    );
    expect(result.reason).toBe('unknown_tag');
  });
});

describe('finance_tag_merge', () => {
  it('skips elicitation for the documented reversible merge operation', async () => {
    const preview = getToolDefinition('finance_tag_merge')?.preview;
    expect(preview).toBeTypeOf('function');
    await expect(preview?.(userId, { from: 'source', into: 'target' })).resolves.toBeNull();
  });

  it('moves assignments, drops duplicates and removes the emptied tag', async () => {
    const { id: source } = await seedTag({ ownerUserid: userId, name: 'merge-a' });
    const { id: target } = await seedTag({ ownerUserid: userId, name: 'merge-b' });
    await seedTagAssignments(source, [entityOne], onNotes);
    await seedTagAssignments(source, [entityTwo], onNotes);
    await seedTagAssignments(target, [entityOne], onNotes); // shared entity — must not be duplicated

    const result = content(
      await callTool(userId, 'finance_tag_merge', { from: 'merge-a', into: 'merge-b' }),
    );
    expect(result.reason).toBeNull();
    expect(result.assignmentsMoved).toBe(1);
    expect(result.tag).toEqual({ id: target, name: 'merge-b' });

    expect(await tagById(source)).toBeUndefined();
    expect(await activeEntityIdsForTag(target)).toEqual([entityOne, entityTwo]);
  });

  it('reports an unknown tag', async () => {
    await seedTag({ ownerUserid: userId, name: 'merge-c' });
    const result = content(
      await callTool(userId, 'finance_tag_merge', { from: 'merge-c', into: 'missing' }),
    );
    expect(result.reason).toBe('unknown_tag');
  });
});
