import { z } from 'zod';

/**
 * MCP (Model Context Protocol) 2024-11-05 — protocol types and helpers.
 *
 * The protocol uses JSON-RPC 2.0.  The server exposes an HTTP endpoint that
 * accepts POST requests with a JSON-RPC body and returns a JSON-RPC response.
 * A GET /mcp/sse endpoint is also provided for clients that prefer the SSE
 * transport (e.g. Claude Desktop).
 */

export const MCP_PROTOCOL_VERSION = '2024-11-05';

// ---------------------------------------------------------------------------
// Inbound
// ---------------------------------------------------------------------------

export const McpRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type McpRequest = z.infer<typeof McpRequestSchema>;

// ---------------------------------------------------------------------------
// Tool structures
// ---------------------------------------------------------------------------

export interface McpToolInputSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export interface McpToolContent {
  type: 'text';
  text: string;
}

export interface McpCallToolResult {
  content: McpToolContent[];
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function mcpSuccess(id: string | number, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

export function mcpError(id: string | number, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

// Standard JSON-RPC / MCP error codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
