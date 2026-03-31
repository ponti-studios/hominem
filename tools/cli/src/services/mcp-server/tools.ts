import { getStoredTokens } from '@/utils/auth';

import type { McpCallToolResult, McpTool } from './protocol';

interface ApiUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiSessionResponse {
  user: ApiUser | null;
  isAuthenticated: boolean;
}

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

function toolResult(payload: unknown): McpCallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

function toolError(message: string): McpCallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

async function getCurrentUserProfile(): Promise<McpCallToolResult> {
  let storedTokens: Awaited<ReturnType<typeof getStoredTokens>> | null;
  try {
    storedTokens = await getStoredTokens();
  } catch (error) {
    return toolError(
      `Unable to read stored auth state: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (!storedTokens?.accessToken) {
    return toolError('No stored auth token found. Run `hominem auth login` first.');
  }

  if (!storedTokens.issuerBaseUrl) {
    return toolError('Stored auth issuer is missing. Run `hominem auth login` again.');
  }

  let sessionUrl: string;
  try {
    sessionUrl = new URL('/api/auth/session', storedTokens.issuerBaseUrl).toString();
  } catch (error) {
    return toolError(
      `Invalid stored auth issuer URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  let response: Response;
  try {
    response = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${storedTokens.accessToken}`,
      },
    });
  } catch (error) {
    return toolError(
      `Failed to reach the API session endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (!response.ok) {
    return toolError(
      `API session request failed with HTTP ${response.status}. Run \`hominem auth login\` to refresh credentials.`,
    );
  }

  let payload: ApiSessionResponse;
  try {
    payload = (await response.json()) as ApiSessionResponse;
  } catch (error) {
    return toolError(
      `API session response was not valid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  if (!payload.isAuthenticated || !payload.user) {
    return toolError('The API session endpoint did not return an authenticated user.');
  }

  return toolResult({
    authenticated: true,
    user: payload.user,
  });
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
    name: 'current_user',
    description: 'Fetch the signed-in user profile from the API session endpoint.',
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

export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<McpCallToolResult> {
  switch (name) {
    case 'ping':
      return toolResult({ ok: true, timestamp: Date.now() });

    case 'agent_health':
      return toolResult({
        status: 'ok',
        service: 'hominem-mcp-server',
        timestamp: Date.now(),
      });

    case 'current_user':
      return getCurrentUserProfile();

    case 'offline_retry_config':
      return toolResult(OFFLINE_FIRST_CONFIG);

    case 'offline_backoff_preview': {
      const raw = args.attempts;
      const attempts = typeof raw === 'number' ? Math.min(Math.max(1, Math.floor(raw)), 10) : 5;
      const schedule = Array.from({ length: attempts }, (_, i) => ({
        attempt: i + 1,
        queryDelayMs: computeBackoffMs(i, OFFLINE_FIRST_CONFIG.queryRetryMaxMs),
        chatDelayMs: computeBackoffMs(i, OFFLINE_FIRST_CONFIG.chatRetryMaxMs),
      }));
      return toolResult(schedule);
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}
