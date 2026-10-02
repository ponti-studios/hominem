import type { z } from 'zod';

/** Parses a tool's structured output with the same schema the tool declares. */
export function toolOutput<TSchema extends z.ZodType>(
  result: { structuredContent?: unknown },
  schema: TSchema,
): z.output<TSchema> {
  return schema.parse(result.structuredContent);
}
