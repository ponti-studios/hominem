import { z } from 'zod';

import type { CapabilityDefinition } from '../application/capability';
import { describeCapability } from './tool-planner';

export const searchToolsInputSchema = z
  .object({
    query: z.string().trim().min(1).max(200),
    limit: z.number().int().min(1).max(20).default(10),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export const searchToolsOutputSchema = z.object({
  tools: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      description: z.string(),
      readOnly: z.boolean(),
      requiresConfirmation: z.boolean(),
    }),
  ),
  count: z.number().int().min(0),
  hasMore: z.boolean(),
});

export const getToolDetailsInputSchema = z
  .object({ name: z.string().trim().min(1).max(128) })
  .strict();

export const getToolDetailsOutputSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  readOnly: z.boolean(),
  requiresConfirmation: z.boolean(),
  annotations: z.object({
    readOnlyHint: z.boolean(),
    destructiveHint: z.boolean(),
    idempotentHint: z.boolean(),
    openWorldHint: z.boolean(),
  }),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
});

export const callToolInputSchema = z
  .object({
    name: z.string().trim().min(1).max(128),
    arguments: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type DiscoveredTool = Pick<
  CapabilityDefinition,
  'name' | 'title' | 'description' | 'readOnly' | 'requiresConfirmation' | 'guidance'
>;

function searchText(tool: DiscoveredTool): { name: string; title: string; description: string } {
  return {
    name: tool.name.toLowerCase(),
    title: tool.title.toLowerCase(),
    description: [describeCapability(tool), tool.guidance?.examples?.join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

export function searchTools(
  query: string,
  definitions: readonly DiscoveredTool[],
  limit: number,
  offset = 0,
) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])];
  const matches = definitions
    .map((tool) => {
      const fields = searchText(tool);
      const score = terms.reduce((total, term) => {
        if (fields.name === term) return total + 12;
        if (fields.name.includes(term)) return total + 8;
        if (fields.title.includes(term)) return total + 5;
        if (fields.description.includes(term)) return total + 1;
        return total;
      }, 0);
      return { tool, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) => right.score - left.score || left.tool.name.localeCompare(right.tool.name),
    );

  return {
    tools: matches.slice(offset, offset + limit).map(({ tool }) => ({
      name: tool.name,
      title: tool.title,
      description: describeCapability(tool),
      readOnly: tool.readOnly,
      requiresConfirmation: tool.requiresConfirmation === true,
    })),
    count: matches.length,
    hasMore: matches.length > offset + limit,
  };
}
