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
    description: [
      describeCapability(tool),
      tool.guidance?.whenToUse,
      tool.guidance?.examples?.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  };
}

// Words that say nothing about which tool to use. Without this list, "list", "past" or "date"
// match dozens of unrelated tools and bury the real one.
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'is',
  'are',
  'was',
  'be',
  'it',
  'its',
  'my',
  'me',
  'i',
  'you',
  'your',
  'we',
  'our',
  'this',
  'that',
  'what',
  'which',
  'who',
  'how',
  'do',
  'does',
  'did',
  'can',
  'please',
  'about',
  'any',
  'some',
  'all',
  'show',
  'give',
  'find',
  'get',
  'list',
  'past',
  'last',
  'next',
  'date',
  'range',
  'new',
  'one',
  'out',
  'up',
]);

// Light stemming so "notes" finds "note" and "events" finds "event". Not a real stemmer.
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).map(stem);
}

export function searchTools(
  query: string,
  definitions: readonly DiscoveredTool[],
  limit: number,
  offset = 0,
) {
  const terms = [
    ...new Set(tokens(query).filter((term) => term.length > 1 && !STOPWORDS.has(term))),
  ];
  const fieldsByTool = definitions.map((tool) => searchText(tool));

  // A term that appears in most tools tells us little. Weight each term by how rare it is.
  const docFrequency = new Map<string, number>();
  for (const fields of fieldsByTool) {
    const seen = new Set(tokens(`${fields.name} ${fields.title} ${fields.description}`));
    for (const term of terms)
      if (seen.has(term)) docFrequency.set(term, (docFrequency.get(term) ?? 0) + 1);
  }
  const total = Math.max(definitions.length, 1);
  const weight = (term: string) => Math.log(1 + total / (1 + (docFrequency.get(term) ?? 0)));

  const matches = definitions
    .map((tool, index) => {
      const fields = fieldsByTool[index]!;
      const nameTokens = tokens(fields.name);
      const titleTokens = tokens(fields.title);
      const score = terms.reduce((total, term) => {
        const idf = weight(term);
        if (nameTokens.includes(term)) return total + 12 * idf;
        if (fields.name.includes(term)) return total + 8 * idf;
        if (titleTokens.includes(term)) return total + 5 * idf;
        if (fields.description.includes(term)) return total + 1 * idf;
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
