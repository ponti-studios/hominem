import {
  acceptMemberInvite,
  addCollectionItem,
  collectionDetail,
  createCollection,
  inviteMember,
  listCollections,
  listPendingInvites,
  removeCollectionItem,
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
  inviteMemberInputSchema,
  inviteMemberOutputSchema,
  listCollectionsInputSchema,
  listCollectionsOutputSchema,
  listPendingInvitesInputSchema,
  listPendingInvitesOutputSchema,
  removeCollectionItemInputSchema,
  removeCollectionItemOutputSchema,
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
