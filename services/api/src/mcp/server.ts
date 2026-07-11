import { logger } from '@hominem/telemetry';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  WebStandardStreamableHTTPServerTransport,
  type WebStandardStreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { CallToolResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from 'hono';

import { UnauthorizedError } from '../errors';
import type { AppContext } from '../rpc/middleware/auth';
import { callTool, listTools, type McpToolDefinition } from './tools';

interface McpAuthInfoExtra {
  ownerUserId: string;
  sessionId: string | null;
  authTime: number;
}

interface McpRequestContext {
  ownerUserId: string;
  grantedScopes: Set<string>;
}

const defaultGrantedScopes = [...new Set(listTools().flatMap((tool) => [...tool.scopes]))];

const transportOptions: WebStandardStreamableHTTPServerTransportOptions = {
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
};

function createErrorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function parseGrantedScopes(rawScopes: string | undefined): string[] {
  if (!rawScopes) {
    // Temporary bridge until an OAuth grant model exists for external MCP
    // clients: authenticated sessions default to the current read-only tool set.
    return defaultGrantedScopes;
  }

  return rawScopes
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function createAuthInfo(c: Context<AppContext>): AuthInfo {
  const userId = c.get('userId');
  if (!userId) {
    throw new UnauthorizedError('Authentication required');
  }

  const session = c.get('auth');
  const grantedScopes = parseGrantedScopes(c.req.header('x-mcp-scopes') ?? undefined);

  return {
    token: c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? session?.sid ?? userId,
    clientId: c.req.header('user-agent') ?? 'hominem-mcp',
    scopes: grantedScopes,
    extra: {
      ownerUserId: userId,
      sessionId: session?.sid ?? null,
      authTime: session?.authTime ?? Math.floor(Date.now() / 1000),
    } satisfies McpAuthInfoExtra,
  };
}

function resolveRequestContext(authInfo?: AuthInfo): McpRequestContext | null {
  const extra = authInfo?.extra as Partial<McpAuthInfoExtra> | undefined;
  const ownerUserId = extra?.ownerUserId;

  if (!ownerUserId) {
    return null;
  }

  return {
    ownerUserId,
    grantedScopes: new Set(authInfo?.scopes ?? []),
  };
}

function hasRequiredScopes(grantedScopes: Set<string>, requiredScopes: readonly string[]): boolean {
  return requiredScopes.every((scope) => grantedScopes.has(scope));
}

function createToolHandler(definition: McpToolDefinition) {
  return async (args: unknown, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
    const context = resolveRequestContext(extra.authInfo);
    if (!context) {
      return createErrorResult('Authentication required');
    }

    if (!hasRequiredScopes(context.grantedScopes, definition.scopes)) {
      return createErrorResult(`Missing required scope(s): ${definition.scopes.join(', ')}`);
    }

    try {
      return await callTool(context.ownerUserId, definition.name, args);
    } catch (error) {
      logger.warn('[mcp] tool invocation failed', {
        tool: definition.name,
        userId: context.ownerUserId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return createErrorResult(error instanceof Error ? error.message : 'Unknown MCP tool error');
    }
  };
}

function createMcpServer() {
  const mcpServer = new McpServer(
    {
      name: 'Hominem MCP',
      version: '1.0.0',
    },
    {
      instructions: 'Read-only MCP tools for authenticated Hominem users.',
    },
  );

  for (const definition of listTools()) {
    mcpServer.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        annotations: {
          readOnlyHint: definition.readOnly,
        },
      },
      createToolHandler(definition),
    );
  }

  return mcpServer;
}

export async function handleMcpRequest(c: Context<AppContext>): Promise<Response> {
  const authInfo = createAuthInfo(c);
  const transport = new WebStandardStreamableHTTPServerTransport(transportOptions);
  const mcpServer = createMcpServer();
  await mcpServer.connect(transport);

  try {
    return await transport.handleRequest(c.req.raw, { authInfo });
  } finally {
    await mcpServer.close();
  }
}
