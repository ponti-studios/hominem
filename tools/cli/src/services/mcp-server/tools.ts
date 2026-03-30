import type { McpCallToolResult, McpTool } from './protocol';

/**
 * Offline-first retry configuration that mirrors the values used by the
 * Hominem mobile app (`apps/mobile/utils/query-client-config.ts` and
 * `apps/mobile/utils/services/chat/chat-contract.ts`).
 *
 * Keeping this in sync lets AI assistants understand exactly how the system
 * handles network interruptions across all platforms.
 */
const OFFLINE_FIRST_CONFIG = {
  networkMode: 'offlineFirst',
  queryRetryMaxMs: 30_000,
  chatRetryMaxMs: 10_000,
  queryMaxRetries: 3,
  mutationRetries: 1,
  staleTimeMs: 60_000,
  gcTimeMs: 600_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

function computeBackoffMs(attemptIndex: number, maxMs: number): number {
  return Math.min(1000 * 2 ** attemptIndex, maxMs);
}

// ---------------------------------------------------------------------------
// Tool catalogue
// ---------------------------------------------------------------------------

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'ping',
    description: 'Verify connectivity to the Hominem MCP server.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'agent_health',
    description: 'Get the current health status of the Hominem MCP server.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'offline_retry_config',
    description:
      'Return the offline-first retry configuration used by all Hominem platform clients ' +
      '(mobile and web). Useful for understanding how the system handles network interruptions.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'offline_backoff_preview',
    description:
      'Preview the exponential backoff delay schedule for a given number of retry attempts. ' +
      'Shows how long the system waits between retries for both queries and chat mutations.',
    inputSchema: {
      type: 'object',
      properties: {
        attempts: {
          type: 'number',
          description: 'Number of retry attempts to preview (1–10)',
        },
      },
      required: ['attempts'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

export function callTool(name: string, args: Record<string, unknown>): McpCallToolResult {
  switch (name) {
    case 'ping':
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, timestamp: Date.now() }) }],
      };

    case 'agent_health':
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'ok',
              service: 'hominem-mcp-server',
              timestamp: Date.now(),
            }),
          },
        ],
      };

    case 'offline_retry_config':
      return {
        content: [{ type: 'text', text: JSON.stringify(OFFLINE_FIRST_CONFIG) }],
      };

    case 'offline_backoff_preview': {
      const raw = args.attempts;
      const attempts =
        typeof raw === 'number' ? Math.min(Math.max(1, Math.floor(raw)), 10) : 5;
      const schedule = Array.from({ length: attempts }, (_, i) => ({
        attempt: i + 1,
        queryDelayMs: computeBackoffMs(i, OFFLINE_FIRST_CONFIG.queryRetryMaxMs),
        chatDelayMs: computeBackoffMs(i, OFFLINE_FIRST_CONFIG.chatRetryMaxMs),
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(schedule) }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
