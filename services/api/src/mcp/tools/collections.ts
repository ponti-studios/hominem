import { NotFoundError, ValidationError } from '@hominem/db/errors';
import { z } from 'zod';

import {
  acceptMemberInvite,
  addCollectionItem,
  collectionDetail,
  createCollection,
  declineMemberInvite,
  deleteCollection,
  inviteMember,
  leaveCollection,
  listCollections,
  listPendingInvites,
  removeCollectionItem,
  removeMember,
  updateCollection,
  updateMemberRole,
} from '../../application/collections.service';
import { getEntityDisplayName } from '../../application/tags.service';
import {
  acceptMemberInviteInputSchema,
  acceptMemberInviteOutputSchema,
  addCollectionItemInputSchema,
  addCollectionItemOutputSchema,
  collectionDetailInputSchema,
  collectionDetailOutputSchema,
  createCollectionInputSchema,
  createCollectionOutputSchema,
  deleteCollectionInputSchema,
  deleteCollectionOutputSchema,
  inviteMemberInputSchema,
  inviteMemberOutputSchema,
  leaveCollectionInputSchema,
  leaveCollectionOutputSchema,
  listCollectionsInputSchema,
  listCollectionsOutputSchema,
  listPendingInvitesInputSchema,
  listPendingInvitesOutputSchema,
  removeCollectionItemInputSchema,
  removeCollectionItemOutputSchema,
  removeMemberInputSchema,
  removeMemberOutputSchema,
  updateCollectionInputSchema,
  updateCollectionOutputSchema,
  updateMemberRoleInputSchema,
  updateMemberRoleOutputSchema,
} from '../../schemas/collections.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'create_collection',
    title: 'Create a collection',
    description: 'Create a new collection for grouping any supported entities.',
    inputSchema: createCollectionInputSchema,
    outputSchema: createCollectionOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: false,
    idempotent: false,
    requiresConfirmation: true,
    guidance: {
      whenToUse: 'The user explicitly requests a new collection and no matching collection exists.',
      whenNotToUse: 'Do not create duplicate collections or execute before confirmation.',
      produces: ['collection id', 'collection name'],
    },
  },
  async (ownerUserId, input) => createCollection(ownerUserId, input),
);

registerTool(
  {
    name: 'add_collection_item',
    title: 'Add item to collection',
    description: 'Add any supported entity to a collection with an optional note.',
    inputSchema: addCollectionItemInputSchema,
    outputSchema: addCollectionItemOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: false,
    idempotent: false,
    guidance: {
      whenToUse:
        'A confirmed collection id and entity id are available and the user asked to add the item.',
      whenNotToUse: 'Do not invent collection or entity ids.',
      dependencies: [
        {
          tool: 'list_collections',
          reason: 'resolve an existing collection when needed',
          provides: ['collectionId'],
        },
      ],
      produces: ['collection item id'],
    },
  },
  async (ownerUserId, input) => addCollectionItem(ownerUserId, input),
);

registerTool(
  {
    name: 'remove_collection_item',
    title: 'Remove item from collection',
    description: 'Remove an entity from a collection.',
    inputSchema: removeCollectionItemInputSchema,
    outputSchema: removeCollectionItemOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    guidance: {
      whenToUse: 'The user explicitly asks to remove a known entity from a collection.',
      whenNotToUse: 'Do not remove items without confirmation or stable collection and entity ids.',
      dependencies: [
        {
          tool: 'list_collections',
          reason: 'resolve the stable collection id',
          provides: ['collectionId'],
        },
      ],
      produces: ['removed state'],
    },
    preview: async (ownerUserId, input) => {
      const parsed = removeCollectionItemInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const [detail, entityName] = await Promise.all([
        collectionDetail(ownerUserId, parsed.data.collectionId),
        getEntityDisplayName(ownerUserId, parsed.data.entityType, parsed.data.entityId),
      ]);
      return {
        collection: detail.collection?.name ?? '(unknown collection)',
        entity: entityName ?? `${parsed.data.entityType.slice(0, -1)} (unknown)`,
      };
    },
  },
  async (ownerUserId, input) => removeCollectionItem(ownerUserId, input),
);

registerTool(
  {
    name: 'invite_member',
    title: 'Invite member to collection',
    description:
      'Invite another hominem user (by email) to collaborate on a collection as an editor or viewer.',
    inputSchema: inviteMemberInputSchema,
    outputSchema: inviteMemberOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: false,
    idempotent: false,
    requiresConfirmation: true,
    guidance: {
      whenToUse: 'The user explicitly asks to invite a collaborator to a known collection.',
      whenNotToUse: 'Do not invite without confirmation or a stable collection id.',
      dependencies: [
        {
          tool: 'list_collections',
          reason: 'resolve the stable collection id',
          provides: ['collectionId'],
        },
      ],
      produces: ['member id', 'invitation state'],
    },
  },
  async (ownerUserId, input) => inviteMember(ownerUserId, input),
);

registerTool(
  {
    name: 'accept_collection_invite',
    title: 'Accept collection invitation',
    description: "Accept the caller's pending invitation to collaborate on a collection.",
    inputSchema: acceptMemberInviteInputSchema,
    outputSchema: acceptMemberInviteOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => acceptMemberInvite(ownerUserId, input),
);

registerTool(
  {
    name: 'accept_member_invite',
    title: 'Accept collection invite',
    description: "Accept the caller's pending invite to collaborate on a collection.",
    inputSchema: acceptMemberInviteInputSchema,
    outputSchema: acceptMemberInviteOutputSchema,
    readOnly: false,
    scopes: ['collections:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => acceptMemberInvite(ownerUserId, input),
);

registerTool(
  {
    name: 'list_pending_collection_invites',
    title: 'List pending collection invitations',
    description: 'List pending invitations to collections for the caller.',
    inputSchema: listPendingInvitesInputSchema,
    outputSchema: listPendingInvitesOutputSchema,
    readOnly: true,
    scopes: ['collections:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => listPendingInvites(ownerUserId, input),
);

registerTool(
  {
    name: 'list_collections',
    title: 'List collections',
    description: 'List collections you own or collaborate on, most recently created first.',
    inputSchema: listCollectionsInputSchema,
    outputSchema: listCollectionsOutputSchema,
    readOnly: true,
    scopes: ['collections:read'],
    resultCap: 50,
  },
  async (ownerUserId, input) => listCollections(ownerUserId, input),
);

registerTool(
  {
    name: 'collection_detail',
    title: 'Collection detail',
    description: "Get a collection's details, items, and members.",
    inputSchema: collectionDetailInputSchema,
    outputSchema: collectionDetailOutputSchema,
    readOnly: true,
    scopes: ['collections:read'],
    resultCap: 100,
  },
  async (ownerUserId, input) => collectionDetail(ownerUserId, input.collectionId),
);

// The REST routes rely on these services throwing NotFoundError (-> 404); MCP tools instead
// report an expected "not found" as ordinary data (see the hominem-mcp-tool skill).
async function nullOnNotFound<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

const updateCollectionToolOutputSchema = z.object({
  collection: updateCollectionOutputSchema.shape.collection.nullable(),
});
const updateMemberRoleToolOutputSchema = z.object({
  member: updateMemberRoleOutputSchema.shape.member.nullable(),
});

const collectionWriteTool: {
  readOnly: false;
  scopes: ['collections:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['collections:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

const collectionIdDependency = [
  {
    tool: 'list_collections',
    reason: 'resolve the stable collection id',
    provides: ['collectionId'],
  },
];

registerTool(
  {
    ...collectionWriteTool,
    idempotent: true,
    name: 'update_collection',
    title: 'Update a collection',
    description:
      "Renames a collection or changes its description or visibility. Only the owner can update it; returns null if it doesn't exist or isn't yours.",
    inputSchema: updateCollectionInputSchema,
    outputSchema: updateCollectionToolOutputSchema,
    guidance: {
      whenToUse: 'The user asks to rename or change a collection they own.',
      whenNotToUse: 'Do not invent a collection id.',
      dependencies: collectionIdDependency,
    },
  },
  async (ownerUserId, input) => ({
    collection:
      (await nullOnNotFound(() => updateCollection(ownerUserId, input)))?.collection ?? null,
  }),
);

registerTool(
  {
    ...collectionWriteTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'delete_collection',
    title: 'Delete a collection',
    description:
      'Permanently deletes a collection you own, along with its membership list. The items in it are not deleted.',
    inputSchema: deleteCollectionInputSchema,
    outputSchema: deleteCollectionOutputSchema,
    guidance: {
      whenToUse: 'The user explicitly asks to delete a collection they own.',
      whenNotToUse: 'Do not delete without confirmation, and do not use it to leave a shared one.',
      dependencies: collectionIdDependency,
    },
    preview: async (ownerUserId, input) => {
      const parsed = deleteCollectionInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const detail = await collectionDetail(ownerUserId, parsed.data.collectionId);
      if (!detail.collection || detail.viewerRole !== 'owner') return null;
      return {
        collection: detail.collection.name,
        items: detail.items.length,
        members: detail.members.length,
      };
    },
  },
  async (ownerUserId, input) => deleteCollection(ownerUserId, input),
);

registerTool(
  {
    ...collectionWriteTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'leave_collection',
    title: 'Leave a collection',
    description:
      "Removes you from a collection someone else owns. Owners can't leave their own collection; use delete_collection instead.",
    inputSchema: leaveCollectionInputSchema,
    outputSchema: leaveCollectionOutputSchema,
    guidance: {
      whenToUse: 'The user asks to stop collaborating on a collection they do not own.',
      whenNotToUse: 'Do not use on a collection the user owns.',
      dependencies: collectionIdDependency,
    },
    preview: async (ownerUserId, input) => {
      const parsed = leaveCollectionInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const detail = await collectionDetail(ownerUserId, parsed.data.collectionId);
      if (!detail.collection || !detail.viewerRole || detail.viewerRole === 'owner') return null;
      return { collection: detail.collection.name, yourRole: detail.viewerRole };
    },
  },
  async (ownerUserId, input) => {
    try {
      return await leaveCollection(ownerUserId, input);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        return { left: false };
      }
      throw error;
    }
  },
);

registerTool(
  {
    ...collectionWriteTool,
    idempotent: true,
    name: 'update_member_role',
    title: "Change a collaborator's role",
    description:
      "Switches a collection member between editor and viewer. Only the owner can do this; returns null if the collection or member isn't found.",
    inputSchema: updateMemberRoleInputSchema,
    outputSchema: updateMemberRoleToolOutputSchema,
    guidance: {
      whenToUse: 'The owner asks to change what a collaborator can do.',
      whenNotToUse: 'Do not invent member ids; read them from collection_detail.',
      dependencies: [
        {
          tool: 'collection_detail',
          reason: 'resolve the member id',
          provides: ['memberId'],
        },
      ],
    },
  },
  async (ownerUserId, input) => ({
    member: (await nullOnNotFound(() => updateMemberRole(ownerUserId, input)))?.member ?? null,
  }),
);

registerTool(
  {
    ...collectionWriteTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'remove_member',
    title: 'Remove a collaborator',
    description: 'Removes a member or pending invite from a collection you own.',
    inputSchema: removeMemberInputSchema,
    outputSchema: removeMemberOutputSchema,
    guidance: {
      whenToUse: 'The owner explicitly asks to remove a collaborator or revoke an invite.',
      whenNotToUse: 'Do not invent member ids; read them from collection_detail.',
      dependencies: [
        {
          tool: 'collection_detail',
          reason: 'resolve the member id',
          provides: ['memberId'],
        },
      ],
    },
    preview: async (ownerUserId, input) => {
      const parsed = removeMemberInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const detail = await collectionDetail(ownerUserId, parsed.data.collectionId);
      if (!detail.collection || detail.viewerRole !== 'owner') return null;
      const member = detail.members.find(
        (candidate) => candidate.id === parsed.data.memberId && candidate.role !== 'owner',
      );
      if (!member) return null;
      return {
        collection: detail.collection.name,
        member: member.userEmail ?? member.invitedEmail ?? '(unknown member)',
        role: member.role,
      };
    },
  },
  async (ownerUserId, input) => ({
    removed: (await nullOnNotFound(() => removeMember(ownerUserId, input)))?.removed ?? false,
  }),
);

registerTool(
  {
    ...collectionWriteTool,
    idempotent: true,
    name: 'decline_collection_invite',
    title: 'Decline collection invitation',
    description: "Declines the caller's pending invitation to collaborate on a collection.",
    inputSchema: acceptMemberInviteInputSchema,
    outputSchema: removeMemberOutputSchema,
    guidance: {
      whenToUse:
        'The user asks to decline an invitation returned by list_pending_collection_invites.',
      whenNotToUse: 'Do not use to leave a collection the user already joined.',
      dependencies: [
        {
          tool: 'list_pending_collection_invites',
          reason: 'resolve the pending invite',
          provides: ['collectionId'],
        },
      ],
    },
  },
  async (ownerUserId, input) => ({
    removed:
      (await nullOnNotFound(() => declineMemberInvite(ownerUserId, input)))?.removed ?? false,
  }),
);
