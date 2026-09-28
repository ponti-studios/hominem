import type { ChatMessageJsonObject } from '@hominem/chat';
import { logger } from '@hominem/telemetry';
import {
  createMcpHandler,
  inputRequired,
  McpServer,
  type AuthInfo,
  type CallToolResult,
  type ElicitResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import type { Context } from 'hono';

import type { CapabilityDefinition } from '../application/capability';
import type { AuthContext } from '../auth/types';
import { UnauthorizedError } from '../errors';
import { confirmationCodec, type ConfirmationState } from './confirmation';
import { describeCapability } from './tool-planner';
import { callTool, listToolsForScopes } from './tool-registry';

const CONFIRM_KEY = 'confirm';

export type McpHonoEnv = {
  Variables: {
    auth?: AuthContext;
  };
};

interface McpAuthInfoExtra {
  ownerUserId: string;
  sessionId: string | null;
}

function createErrorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

const PUBLIC_TOOL_ERROR = 'Unable to complete the MCP tool request.';

function resolveRequestContext(authInfo?: AuthInfo) {
  const ownerUserId = authInfo?.extra?.ownerUserId;
  if (typeof ownerUserId !== 'string' || !ownerUserId) return null;
  return { ownerUserId, grantedScopes: new Set(authInfo?.scopes ?? []) };
}

function hasRequiredScopes(grantedScopes: Set<string>, requiredScopes: readonly string[]): boolean {
  return requiredScopes.every((scope) => grantedScopes.has(scope));
}

function buildCancelledResult(message: string): CallToolResult {
  // isError: true, not false — the SDK's registerTool wrapper requires
  // structuredContent on any non-error result once a tool declares an
  // outputSchema, and a generic cancellation has no schema-shaped payload to
  // offer (the shape differs per tool: { removed }, { task: null }, ...).
  // Mirrors createErrorResult's already-established structured-content-less
  // convention in this file.
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function invokeTool(
  ownerUserId: string,
  toolName: string,
  args: unknown,
): Promise<CallToolResult> {
  try {
    return await callTool(ownerUserId, toolName, args);
  } catch (error) {
    logger.warn('[mcp] tool invocation failed', {
      tool: toolName,
      userId: ownerUserId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return createErrorResult(PUBLIC_TOOL_ERROR);
  }
}

function createToolHandler(definition: CapabilityDefinition, fallbackAuthInfo?: AuthInfo) {
  return async (args: unknown, ctx: ServerContext) => {
    const context = resolveRequestContext(ctx.http?.authInfo ?? fallbackAuthInfo);
    if (!context) {
      return createErrorResult('Authentication required');
    }

    if (!hasRequiredScopes(context.grantedScopes, definition.scopes)) {
      return createErrorResult(`Missing required scope(s): ${definition.scopes.join(', ')}`);
    }

    // Protocol-level confirmation (Multi Round-Trip Requests, spec revision
    // 2026-07-28): requiresConfirmation previously only gated Hominem's own
    // chat UI (see chat-generation-engine.ts's requiresConfirmation callback),
    // never this HTTP endpoint — any other MCP client (Claude Desktop, ChatGPT
    // connectors) executed a destructive tool immediately. This makes
    // confirmation a property of the tool call itself, enforced for every
    // MCP client.
    if (definition.requiresConfirmation) {
      const state = ctx.mcpReq.requestState<ConfirmationState>();

      if (state) {
        // Retry round: the seam has already verified `state` via
        // confirmationCodec.verify before the handler runs. Reject a token
        // minted for a different tool (defense against splicing a
        // confirmation token from one tool call onto another).
        if (state.tool !== definition.name) {
          return createErrorResult('Confirmation state does not match this tool');
        }
        const response = ctx.mcpReq.inputResponses?.[CONFIRM_KEY] as ElicitResult | undefined;
        if (response?.action !== 'accept') {
          return buildCancelledResult(`${definition.title} was cancelled.`);
        }
        // Execute with the args captured at mint time, not whatever arrived
        // on the retried wire call — a client can't change the payload
        // between the preview shown and the confirmed execution.
        return invokeTool(context.ownerUserId, definition.name, state.args);
      }

      // First call. A tool with a preview function only skips confirmation
      // when that preview explicitly returns null (e.g. the target is
      // already gone), matching today's single-round-trip no-op behavior. A
      // tool with NO preview function has no such signal, so it must always
      // confirm — falling through here would execute destructive tools like
      // create_collection/invite_member with zero confirmation.
      const preview = definition.preview
        ? await definition.preview(context.ownerUserId, args as ChatMessageJsonObject)
        : undefined;
      if (preview !== null) {
        const message = definition.preview
          ? `Confirm: ${definition.title} — ${JSON.stringify(preview)}`
          : `Confirm: ${definition.title}?`;
        return inputRequired({
          inputRequests: {
            [CONFIRM_KEY]: inputRequired.elicit({
              message,
              requestedSchema: { type: 'object', properties: {} },
            }),
          },
          requestState: await confirmationCodec.mint({ tool: definition.name, args }, ctx),
        });
      }
    }

    return invokeTool(context.ownerUserId, definition.name, args);
  };
}

function createMcpServer(authInfo?: AuthInfo) {
  const mcpServer = new McpServer(
    { name: 'Hominem MCP', version: '1.0.0' },
    {
      instructions: 'MCP tools for authenticated Hominem users.',
      requestState: { verify: confirmationCodec.verify },
    },
  );

  for (const definition of listToolsForScopes(authInfo?.scopes ?? [])) {
    // Every write tool should declare these explicitly (see mcp/tools/*.ts) —
    // this is a conservative fallback, not a name-based guess: a read tool is
    // never destructive, and an unannotated write tool is assumed destructive
    // and non-idempotent (the MCP spec's own "assume the worst" default),
    // rather than mislabeled by matching against delete/remove/update/save.
    const destructive = definition.destructive ?? !definition.readOnly;
    const idempotent = definition.idempotent ?? false;

    mcpServer.registerTool(
      definition.name,
      {
        title: definition.title,
        description: describeCapability(definition),
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        annotations: {
          readOnlyHint: definition.readOnly,
          destructiveHint: destructive,
          idempotentHint: idempotent,
          openWorldHint: definition.openWorld ?? false,
        },
        _meta: {
          'openai/toolInvocation/invoking': definition.invoking ?? `${definition.title}…`,
          'openai/toolInvocation/invoked': definition.invoked ?? `${definition.title} complete.`,
        },
      },
      createToolHandler(definition, authInfo),
    );
  }

  return mcpServer;
}

const mcpHandler = createMcpHandler(({ authInfo }) => createMcpServer(authInfo), {
  legacy: 'stateless',
  responseMode: 'json',
});

export async function handleMcpRequest(c: Context<McpHonoEnv>): Promise<Response> {
  const auth = c.get('auth');

  if (!auth) {
    throw new UnauthorizedError('MCP authentication required');
  }

  const authInfo: AuthInfo = {
    token: c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '',
    clientId: auth.clientId ?? 'hominem-mcp',
    scopes: auth.scopes,
    extra: {
      ownerUserId: auth.userId,
      sessionId: auth.sessionId ?? null,
    } satisfies McpAuthInfoExtra,
  };

  return mcpHandler.fetch(c.req.raw, { authInfo });
}
