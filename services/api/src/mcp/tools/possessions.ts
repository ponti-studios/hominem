import { z } from 'zod';

import {
  createContainer,
  createPossession,
  getContainer,
  getContainerImpact,
  getContainerContents,
  getPossession,
  movePossessions,
  removeContainerIfExists,
  removePossessionIfExists,
  searchContainers,
  searchPossessions,
  summarizePossessions,
  updateContainerOrNull,
  updatePossessionOrNull,
} from '../../application/possessions.service';
import {
  containerCreateSchema,
  containerSearchInputSchema,
  containerMcpUpdateSchema,
  containerMoveSchema,
  containerRecordSchema,
  possessionCreateSchema,
  possessionIdParamSchema,
  possessionMcpUpdateSchema,
  possessionMoveSchema,
  possessionRecordSchema,
  possessionSearchInputSchema,
  possessionSummarySchema,
} from '../../schemas/possessions.schema';
import { registerTool } from '../tool-registry';

const LIST_CAP = 100;

const readTool = { readOnly: true, scopes: ['possessions:read'] } as const;

// Baseline for a "create" tool (destructive: false, idempotent: false); update/move/delete
// tools override below.
const writeTool: {
  readOnly: false;
  scopes: ['possessions:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['possessions:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

const possessionLookup = {
  tool: 'possession_list',
  reason: 'resolve the stable possession id (search by name, brand or model)',
  provides: ['id'],
} as const;
const containerLookup = {
  tool: 'container_list',
  reason: 'resolve the stable container id',
  provides: ['id', 'containerId', 'parentContainerId'],
} as const;

// ---- possessions: read ----

registerTool(
  {
    ...readTool,
    name: 'possession_list',
    title: 'List possessions',
    description:
      "Lists the user's possessions, newest first. Filter by status (wishlist, planned, ordered, " +
      'delivered, owned, in_use, retired, disposed), archived flag, containerId, category, and a ' +
      'text query matching name, brand or model — use these instead of listing everything and ' +
      'filtering client-side. Returns up to 100 per call; pass offset to page further. Archived ' +
      'items are included unless archived=false.',
    inputSchema: possessionSearchInputSchema,
    outputSchema: z.object({ possessions: z.array(possessionRecordSchema) }),
    resultCap: LIST_CAP,
    guidance: {
      whenToUse: 'Finding an item, browsing a category, or resolving a possession id.',
      dependencies: [containerLookup].map((dep) => ({
        ...dep,
        reason: 'filter by container (containerId)',
      })),
      produces: ['id'],
    },
  },
  async (ownerUserId, input) => ({ possessions: await searchPossessions(ownerUserId, input) }),
);

registerTool(
  {
    ...readTool,
    name: 'possession_get',
    title: 'Get a possession',
    description: 'Returns one possession by id, or null if it does not exist.',
    inputSchema: possessionIdParamSchema,
    outputSchema: z.object({ possession: possessionRecordSchema.nullable() }),
    resultCap: 1,
    guidance: {
      whenToUse: 'A possession id has been returned by possession_list.',
      whenNotToUse: 'Do not invent a possession id.',
      dependencies: [possessionLookup],
    },
  },
  async (ownerUserId, input) => ({ possession: await getPossession(ownerUserId, input.id) }),
);

registerTool(
  {
    ...readTool,
    name: 'possession_summary',
    title: 'Summarize possessions',
    description:
      'Inventory overview of non-archived possessions: total count, how many are not in any ' +
      'container, counts by status and top categories, and total purchase/sell value for up to ' +
      '20 currencies (most-used first); currenciesOmitted says how many more were left out.',
    inputSchema: z.object({}),
    outputSchema: z.object({ summary: possessionSummarySchema }),
    resultCap: 1,
    guidance: { whenToUse: 'Questions like "how much stuff do I own" or "what is it all worth".' },
  },
  async (ownerUserId) => ({ summary: await summarizePossessions(ownerUserId) }),
);

// ---- possessions: write ----

registerTool(
  {
    ...writeTool,
    name: 'possession_create',
    title: 'Create a possession',
    description:
      'Creates a possession. Prices are integer cents with a 3-letter currencyCode. To place it, ' +
      'pass a containerId from container_list. Search with possession_list first to avoid duplicates.',
    inputSchema: possessionCreateSchema,
    outputSchema: z.object({ possession: possessionRecordSchema }),
    guidance: { dependencies: [containerLookup], produces: ['id'] },
  },
  async (ownerUserId, input) => ({ possession: await createPossession(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'possession_update',
    title: 'Update a possession',
    description:
      'Updates fields on a possession. Only provided fields change; metadata keys are merged, ' +
      'not replaced. Returns null if the possession does not exist. Use isArchived to archive, ' +
      'status to move it through the lifecycle.',
    inputSchema: possessionMcpUpdateSchema,
    outputSchema: z.object({ possession: possessionRecordSchema.nullable() }),
    guidance: {
      whenToUse: 'A possession id has been returned by possession_list or possession_get.',
      whenNotToUse: 'Do not invent a possession id.',
      dependencies: [possessionLookup],
    },
  },
  async (ownerUserId, input) => ({
    possession: await updatePossessionOrNull(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'possession_move',
    title: 'Move possessions into a container',
    description:
      'Moves up to 50 possessions into a container, or out of any container when containerId is ' +
      'null. Returns the ids that moved and the ids that were not found.',
    inputSchema: possessionMoveSchema,
    outputSchema: z.object({ moved: z.array(z.uuid()), missing: z.array(z.uuid()) }),
    resultCap: 50,
    guidance: {
      whenToUse: 'Packing, unpacking or relocating several items at once.',
      dependencies: [possessionLookup, containerLookup],
    },
  },
  async (ownerUserId, input) => movePossessions(ownerUserId, input.ids, input.containerId),
);

registerTool(
  {
    ...writeTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'possession_delete',
    title: 'Delete a possession',
    description:
      'Permanently deletes a possession. Prefer possession_update with isArchived=true or ' +
      'status=disposed to keep history.',
    inputSchema: possessionIdParamSchema,
    outputSchema: z.object({ removed: z.boolean() }),
    guidance: {
      whenToUse: 'The user explicitly wants the record gone.',
      whenNotToUse: 'Do not delete before lookup and confirmation; archive instead when unsure.',
      dependencies: [possessionLookup],
    },
    preview: async (ownerUserId, input) => {
      const parsed = possessionIdParamSchema.safeParse(input);
      if (!parsed.success) return null;
      const possession = await getPossession(ownerUserId, parsed.data.id);
      return possession ? { name: possession.name, status: possession.status } : null;
    },
  },
  async (ownerUserId, input) => ({
    removed: await removePossessionIfExists(ownerUserId, input.id),
  }),
);

// ---- containers ----

registerTool(
  {
    ...readTool,
    name: 'container_list',
    title: 'List containers',
    description:
      'Lists containers (boxes, rooms, shelves, bags) ordered by name, each with its parent ' +
      'container id and a count of non-archived possessions inside. The nesting tree can be ' +
      'rebuilt from parentContainerId. Pages of up to 100: use offset to continue, query to match ' +
      "a name, or parentContainerId to list one container's direct children.",
    inputSchema: containerSearchInputSchema,
    outputSchema: z.object({ containers: z.array(containerRecordSchema) }),
    resultCap: LIST_CAP,
    guidance: {
      whenToUse: 'Resolving a container id or seeing how things are organized.',
      produces: ['id'],
    },
  },
  async (ownerUserId, input) => ({
    containers: await searchContainers(ownerUserId, input),
  }),
);

registerTool(
  {
    ...readTool,
    name: 'container_get',
    title: 'Get a container and its contents',
    description:
      'Returns a container with its direct child containers and the possessions inside it ' +
      '(each capped at 100; totalChildren / totalPossessions give the full counts, archived ' +
      'possessions included). When a total exceeds what was returned, page with container_list ' +
      '(parentContainerId) or possession_list (containerId) using offset. container is null if ' +
      'it does not exist.',
    inputSchema: possessionIdParamSchema,
    outputSchema: z.object({
      container: containerRecordSchema.nullable(),
      children: z.array(containerRecordSchema),
      possessions: z.array(possessionRecordSchema),
      totalChildren: z.number(),
      totalPossessions: z.number(),
    }),
    resultCap: LIST_CAP,
    guidance: {
      whenToUse: 'Asking "what is in X" or "what is inside this box".',
      whenNotToUse: 'Do not invent a container id.',
      dependencies: [containerLookup],
    },
  },
  async (ownerUserId, input) =>
    (await getContainerContents(ownerUserId, input.id, LIST_CAP)) ?? {
      container: null,
      children: [],
      possessions: [],
      totalChildren: 0,
      totalPossessions: 0,
    },
);

registerTool(
  {
    ...writeTool,
    name: 'container_create',
    title: 'Create a container',
    description:
      'Creates a container, optionally nested inside another via parentContainerId. Check ' +
      'container_list first to avoid duplicates.',
    inputSchema: containerCreateSchema,
    outputSchema: z.object({ container: containerRecordSchema }),
    guidance: { dependencies: [containerLookup], produces: ['id'] },
  },
  async (ownerUserId, input) => ({ container: await createContainer(ownerUserId, input) }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'container_update',
    title: 'Update a container',
    description:
      'Updates fields on a container. Only provided fields change; metadata keys are merged. ' +
      'Returns null if the container does not exist. Re-parenting that would nest a container ' +
      'inside itself or its own contents is rejected.',
    inputSchema: containerMcpUpdateSchema,
    outputSchema: z.object({ container: containerRecordSchema.nullable() }),
    guidance: {
      whenToUse: 'A container id has been returned by container_list or container_get.',
      whenNotToUse: 'Do not invent a container id.',
      dependencies: [containerLookup],
    },
  },
  async (ownerUserId, input) => ({
    container: await updateContainerOrNull(ownerUserId, input.id, input.data),
  }),
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'container_move',
    title: 'Move a container',
    description:
      'Nests a container inside another (parentContainerId) or makes it top-level (null). ' +
      'Cycles are rejected. Returns null if the container does not exist.',
    inputSchema: containerMoveSchema,
    outputSchema: z.object({ container: containerRecordSchema.nullable() }),
    guidance: {
      whenToUse: 'Re-organizing the container hierarchy.',
      dependencies: [containerLookup],
    },
  },
  async (ownerUserId, input) => ({
    container: await updateContainerOrNull(ownerUserId, input.id, {
      parentContainerId: input.parentContainerId,
    }),
  }),
);

registerTool(
  {
    ...writeTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'container_delete',
    title: 'Delete a container',
    description:
      'Deletes a container. Possessions and child containers inside it are NOT deleted: they ' +
      'become unplaced / top-level.',
    inputSchema: possessionIdParamSchema,
    outputSchema: z.object({ removed: z.boolean() }),
    guidance: {
      whenNotToUse: 'Do not delete before lookup and confirmation.',
      dependencies: [containerLookup],
    },
    preview: async (ownerUserId, input) => {
      const parsed = possessionIdParamSchema.safeParse(input);
      if (!parsed.success) return null;
      const [container, impact] = await Promise.all([
        getContainer(ownerUserId, parsed.data.id),
        getContainerImpact(ownerUserId, parsed.data.id),
      ]);
      return container && impact
        ? {
            name: container.name,
            possessionsBecomingUnplaced: impact.possessions,
            childContainersBecomingTopLevel: impact.childContainers,
          }
        : null;
    },
  },
  async (ownerUserId, input) => ({ removed: await removeContainerIfExists(ownerUserId, input.id) }),
);
