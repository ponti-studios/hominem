import type { McpToolResult } from '../../mcp/tool-registry';

/** A tool's structured payload, typed by the suite: `const content = structuredContent<Shape>;` */
export function structuredContent<Content extends object>(
  result: McpToolResult<Content>,
): Partial<Content> {
  // Suites declare all-optional shapes, so an empty payload still satisfies them.
  return (result.structuredContent ?? {}) as Partial<Content>;
}
