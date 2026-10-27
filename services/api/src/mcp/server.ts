import { chatMessageJsonObjectSchema, type ChatMessageJsonObject } from '@hominem/chat';
import { logger } from '@hominem/telemetry';
import { isObject } from '@hominem/utils';
import {
  createMcpHandler,
  inputRequired,
  inputResponse,
  McpServer,
  type AuthInfo,
  type CacheHint,
  type CallToolResult,
  type ServerContext,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import type { Context } from 'hono';
import { ZodError, z } from 'zod';

import type { CapabilityDefinition } from '../application/capability';
import type { AuthContext } from '../auth/types';
import { getServiceErrorFailureType, isServiceError, UnauthorizedError } from '../errors';
import {
  clientCanElicit,
  confirmationCodec,
  CONFIRM_TOKEN_KEY,
  type ConfirmationState,
} from './confirmation';
import { registerPrompts } from './prompts';
import { registerResources } from './resources';
import { describeCapability } from './tool-planner';
import { callTool, listToolsForScopes } from './tool-registry';

const CONFIRM_KEY = 'confirm';

// The tool/prompt/discover lists are static per deploy (they only change when
// new code ships), but `tools/list` alone is ~247 KiB. Let 2026-07-28 clients
// cache them briefly instead of re-fetching on every connection. Private, never
// public, because each result is filtered to the caller's granted scopes.
const LIST_CACHE_HINT: CacheHint = { ttlMs: 5 * 60 * 1000, cacheScope: 'private' };

const JSON_SCHEMA_TARGET = 'draft-2020-12';

// zod's `~standard.jsonSchema` re-walks the whole schema tree (and deep-copies the
// result via JSON.parse(JSON.stringify)) on every call. The MCP SDK calls it once at
// registerTool and again at tools/list — for every tool, on every request, because
// createMcpHandler builds a fresh McpServer per request. The schemas are static module
// constants, so cache the conversion per schema and hand the SDK a wrapper that serves
// the cached JSON Schema while delegating validation back to the original zod schema.
// Validation semantics are therefore unchanged; only the repeated conversion is skipped.
const jsonSchemaCache = new WeakMap<
  object,
  { input: Record<string, unknown>; output: Record<string, unknown> }
>();

function cachedJsonSchema(schema: StandardSchemaWithJSON): StandardSchemaWithJSON {
  const cached =
    jsonSchemaCache.get(schema) ??
    (() => {
      const entry = {
        input: schema['~standard'].jsonSchema.input({ target: JSON_SCHEMA_TARGET }),
        output: schema['~standard'].jsonSchema.output({ target: JSON_SCHEMA_TARGET }),
      };
      jsonSchemaCache.set(schema, entry);
      return entry;
    })();

  return {
    '~standard': {
      version: 1,
      vendor: 'hominem-cached-schema',
      validate: schema['~standard'].validate,
      jsonSchema: {
        input: () => cached.input,
        output: () => cached.output,
      },
    },
  };
}

// Confirming tools accept the token that completes a preview the client has
// already been shown (see createToolHandler). It is declared on the schema, not
// just read off the wire, because a strict client validates the model's
// arguments against the advertised schema and drops anything undeclared — an
// undeclared token would never reach this server.
const confirmTokenArgumentSchema = z.object({
  [CONFIRM_TOKEN_KEY]: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Only for completing a call that returned a preview instead of running: ' +
        'repeat the same call with the same arguments plus this token. Omit it on the first call.',
    ),
});

const confirmableInputSchemas = new WeakMap<object, z.ZodType>();

function mcpInputSchema(definition: CapabilityDefinition): StandardSchemaWithJSON {
  if (!definition.requiresConfirmation) return cachedJsonSchema(definition.inputSchema);

  // Intersected once per underlying schema, so the cached JSON Schema
  // conversion still happens exactly once per tool rather than per request.
  const cached = confirmableInputSchemas.get(definition.inputSchema);
  if (cached) return cachedJsonSchema(cached);

  const confirmable = z.intersection(definition.inputSchema, confirmTokenArgumentSchema);
  confirmableInputSchemas.set(definition.inputSchema, confirmable);
  return cachedJsonSchema(confirmable);
}

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

function readConfirmToken(args: unknown): string | undefined {
  if (!isObject(args)) return undefined;
  const token = args[CONFIRM_TOKEN_KEY];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

// Same shape as buildCancelledResult (no structured content) for the same
// reason: the tool's output schema describes a completed call, and this one
// deliberately did nothing. The preview is the whole point — it shows exactly
// what a confirmation would affect.
function buildConfirmTokenResult(
  definition: CapabilityDefinition,
  preview: ChatMessageJsonObject | undefined,
  token: string,
): CallToolResult {
  const previewText =
    preview === undefined
      ? ''
      : ` This is exactly what it will affect: ${JSON.stringify(preview)}.`;
  return {
    content: [
      {
        type: 'text',
        text:
          `${definition.name} was not run: it needs confirmation.${previewText} ` +
          `Nothing has been changed. To complete it, call ${definition.name} again with the ` +
          `same arguments plus ${CONFIRM_TOKEN_KEY}: ${JSON.stringify(token)}.`,
      },
    ],
    isError: true,
  };
}

/**
 * Verifies a token handed back in the arguments and returns the state it froze.
 * Anything that does not verify — tampered, expired, minted for another user or
 * another tool — is treated as no confirmation at all and falls through to the
 * normal preview, so a bad token can never execute anything.
 */
async function confirmTokenState(
  token: string,
  definition: CapabilityDefinition,
  ctx: ServerContext,
): Promise<ConfirmationState | null> {
  try {
    const state = await confirmationCodec.verify(token, ctx);
    return state.tool === definition.name ? state : null;
  } catch {
    return null;
  }
}

async function invokeTool(
  ownerUserId: string,
  toolName: string,
  args: unknown,
): Promise<CallToolResult> {
  try {
    return await callTool(ownerUserId, toolName, args);
  } catch (error) {
    logger.warn('mcp_tool_invocation_failed', {
      operation: 'mcp.tool.invoke',
      failureType: isServiceError(error)
        ? getServiceErrorFailureType(error)
        : error instanceof ZodError
          ? 'mcp.tool.invalid_input'
          : 'mcp.tool.invocation_failed',
      failureCategory:
        error instanceof ZodError
          ? 'validation'
          : isServiceError(error)
            ? error.code.toLowerCase()
            : 'unhandled',
      error_name: error instanceof Error ? error.name : 'unknown',
      tool: toolName,
    });
    // A known service error (e.g. a validation failure the caller can act on) carries a
    // client-safe message — surface it instead of the opaque generic text, which gave the
    // caller no way to tell a bad payload from a server fault. Invalid input (a Zod schema
    // failure) is likewise the caller's to fix, so it gets the same treatment. Anything else
    // stays generic so internals are never leaked.
    if (error instanceof ZodError) {
      const detail = error.issues
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        .join('; ');
      return createErrorResult(`Invalid input: ${detail}`);
    }
    if (isServiceError(error)) return createErrorResult(error.message);
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
      return createErrorResult('insufficient_scope');
    }

    // Protocol-level confirmation enforced for every MCP client, in one gate
    // rather than per tool. Two transports, same safety bar:
    //
    // - Clients that can answer an embedded elicitation (2026-07-28 multi
    //   round-trip requests) confirm interactively, exactly as before.
    // - Clients that cannot (2025-era protocol — ChatGPT connectors, the legacy
    //   Muse CLI — or a modern client without the capability) get the preview
    //   plus a confirmation token instead. They repeat the call with that token
    //   to complete it: a two-step flow the model can drive from an ordinary
    //   tool result, with no protocol feature it lacks.
    //
    // Neither path executes anything unconfirmed.
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
        const response = inputResponse(ctx.mcpReq.inputResponses, CONFIRM_KEY);
        if (response.kind !== 'elicit' || response.action !== 'accept') {
          return buildCancelledResult(`${definition.title} was cancelled.`);
        }
        // Execute with the args captured at mint time, not whatever arrived
        // on the retried wire call — a client can't change the payload
        // between the preview shown and the confirmed execution.
        return invokeTool(context.ownerUserId, definition.name, state.args);
      }

      const confirmToken = readConfirmToken(args);
      if (confirmToken) {
        const confirmed = await confirmTokenState(confirmToken, definition, ctx);
        // The token froze the arguments at mint time, so what runs is what the
        // preview described, not whatever this round's wire call carried.
        if (confirmed) return invokeTool(context.ownerUserId, definition.name, confirmed.args);
      }

      // First call. A tool with a preview function only skips confirmation
      // when that preview explicitly returns null (e.g. the target is
      // already gone), matching today's single-round-trip no-op behavior. A
      // tool with NO preview function has no such signal, so it must always
      // confirm — falling through here would execute destructive tools like
      // create_collection/invite_member with zero confirmation.
      const preview = definition.preview
        ? await definition.preview(context.ownerUserId, chatMessageJsonObjectSchema.parse(args))
        : undefined;
      if (preview !== null) {
        if (!clientCanElicit(ctx)) {
          const token = await confirmationCodec.mint(
            { tool: definition.name, args: chatMessageJsonObjectSchema.parse(args) },
            ctx,
          );
          return buildConfirmTokenResult(definition, preview, token);
        }
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
      instructions:
        'MCP tools, resources and prompts for authenticated Hominem users. Resources under hominem:// expose your own profile, memories, collections, tasks and notes.',
      requestState: { verify: confirmationCodec.verify },
      cacheHints: {
        'tools/list': LIST_CACHE_HINT,
        'prompts/list': LIST_CACHE_HINT,
        'server/discover': LIST_CACHE_HINT,
      },
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
        inputSchema: mcpInputSchema(definition),
        outputSchema: definition.outputSchema
          ? cachedJsonSchema(definition.outputSchema)
          : undefined,
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

  // Resources and prompts read through the same registered tools as tools/call, so they
  // inherit the same owner scoping, scope checks and result validation.
  const scope = resolveRequestContext(authInfo);
  if (scope) {
    registerResources(mcpServer, scope);
    registerPrompts(mcpServer, scope);
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
