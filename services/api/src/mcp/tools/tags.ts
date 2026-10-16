import {
  getEntityDisplayName,
  getTagName,
  listEntityTags,
  tagEntity,
  untagEntity,
} from '../../application/tags.service';
import {
  entityTagsInputSchema,
  entityTagsOutputSchema,
  tagEntityInputSchema,
  tagEntityOutputSchema,
  untagEntityInputSchema,
  untagEntityOutputSchema,
} from '../../schemas/tags.schema';
import { registerTool } from '../tool-registry';

registerTool(
  {
    name: 'tag_entity',
    title: 'Tag an entity',
    description:
      'Tags an owned person, venue place, possession, note, or travel entity with a named tag. Travel Place and Residence are distinct from venue places.',
    inputSchema: tagEntityInputSchema,
    outputSchema: tagEntityOutputSchema,
    readOnly: false,
    scopes: ['tags:write'],
    resultCap: 1,
    destructive: false,
    idempotent: true,
  },
  async (ownerUserId, input) => tagEntity(ownerUserId, input),
);

registerTool(
  {
    name: 'untag_entity',
    title: 'Untag an entity',
    description:
      'Removes a tag from an owned person, venue place, possession, note, or travel entity, including a Residence.',
    inputSchema: untagEntityInputSchema,
    outputSchema: untagEntityOutputSchema,
    readOnly: false,
    scopes: ['tags:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (ownerUserId, input) => {
      const parsed = untagEntityInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const [tagName, entityName] = await Promise.all([
        getTagName(ownerUserId, parsed.data.tagId),
        getEntityDisplayName(ownerUserId, parsed.data.entityType, parsed.data.entityId),
      ]);
      return {
        tag: tagName ?? '(unknown tag)',
        entity: entityName ?? `${parsed.data.entityType.slice(0, -1)} (unknown)`,
      };
    },
  },
  async (ownerUserId, input) => untagEntity(ownerUserId, input),
);

registerTool(
  {
    name: 'entity_tags',
    title: 'List tags on an entity',
    description:
      'Lists tags assigned to an owned person, venue place, possession, note, or travel entity, including a Residence.',
    inputSchema: entityTagsInputSchema,
    outputSchema: entityTagsOutputSchema,
    readOnly: true,
    scopes: ['tags:read'],
    resultCap: 100,
  },
  async (ownerUserId, input) => listEntityTags(ownerUserId, input),
);
