import { NotFoundError } from '@hominem/db/errors';
import {
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer,
  type ReadResourceResult,
} from '@modelcontextprotocol/server';
import { z } from 'zod';

import { callTool, getToolDefinition } from './tool-registry';

export interface McpRequestScope {
  ownerUserId: string;
  grantedScopes: ReadonlySet<string>;
}

const JSON_MIME = 'application/json';
const LIST_LIMIT = 50;
const COMPLETE_LIMIT = 100;

// Slow-moving data a client may reasonably reuse briefly; never shared across users.
const CACHE_HINT = { ttlMs: 30_000, cacheScope: 'private' } as const;

const listedItemsSchema = (key: string) =>
  z.object({
    [key]: z.array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        title: z.string().nullable().optional(),
      }),
    ),
  });

/** True when the tool exists and the token grants every scope it needs. */
export function canUseTool(scope: McpRequestScope, toolName: string): boolean {
  const definition = getToolDefinition(toolName);
  return !!definition && definition.scopes.every((s) => scope.grantedScopes.has(s));
}

async function callToolData(scope: McpRequestScope, toolName: string, input: unknown) {
  const result = await callTool(scope.ownerUserId, toolName, input);
  return result.structuredContent;
}

function jsonContents(uri: URL, data: unknown): ReadResourceResult {
  return { contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(data) }] };
}

function singleVariable(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}

async function readEntity(
  scope: McpRequestScope,
  uri: URL,
  variable: string | string[] | undefined,
  toolName: string,
  buildInput: (id: string) => unknown,
  isMissing: (data: Record<string, unknown> | null) => boolean,
): Promise<ReadResourceResult> {
  const id = singleVariable(variable);
  if (!id) throw new ResourceNotFoundError(uri.href);
  let data: Record<string, unknown> | null;
  try {
    data = await callToolData(scope, toolName, buildInput(id));
  } catch (error) {
    // Malformed ids fail input validation and unknown collections throw NotFoundError;
    // both are "no such resource" to the client rather than a server fault.
    if (error instanceof NotFoundError || error instanceof z.ZodError) {
      throw new ResourceNotFoundError(uri.href);
    }
    throw error;
  }
  if (isMissing(data)) throw new ResourceNotFoundError(uri.href);
  return jsonContents(uri, data);
}

async function listEntities(
  scope: McpRequestScope,
  toolName: string,
  input: unknown,
  key: string,
  uriPrefix: string,
  label: 'name' | 'title',
) {
  const data = await callToolData(scope, toolName, input);
  const parsed = listedItemsSchema(key).parse(data);
  return {
    resources: (parsed[key] ?? []).map((item) => ({
      uri: `${uriPrefix}${item.id}`,
      name: (label === 'name' ? item.name : item.title) ?? item.id,
      mimeType: JSON_MIME,
    })),
  };
}

async function completeIds(
  scope: McpRequestScope,
  toolName: string,
  input: unknown,
  key: string,
  prefix: string,
): Promise<string[]> {
  const data = await callToolData(scope, toolName, input);
  const parsed = listedItemsSchema(key).parse(data);
  return (parsed[key] ?? [])
    .map((item) => item.id)
    .filter((id) => id.startsWith(prefix))
    .slice(0, COMPLETE_LIMIT);
}

export function registerResources(mcpServer: McpServer, scope: McpRequestScope): void {
  if (canUseTool(scope, 'career_profile')) {
    mcpServer.registerResource(
      'profile',
      'hominem://profile',
      {
        title: 'Career profile',
        description:
          'Your career profile: roles, skills and education. Contact details are omitted.',
        mimeType: JSON_MIME,
        cacheHint: CACHE_HINT,
      },
      async (uri) => jsonContents(uri, await callToolData(scope, 'career_profile', {})),
    );
  }

  if (canUseTool(scope, 'list_memories')) {
    mcpServer.registerResource(
      'memories',
      'hominem://memories',
      {
        title: 'Remembered facts',
        description: 'The most recent facts and preferences Hominem has remembered about you.',
        mimeType: JSON_MIME,
        cacheHint: CACHE_HINT,
      },
      async (uri) =>
        jsonContents(uri, await callToolData(scope, 'list_memories', { limit: LIST_LIMIT })),
    );
  }

  if (canUseTool(scope, 'collection_detail') && canUseTool(scope, 'list_collections')) {
    mcpServer.registerResource(
      'collection',
      new ResourceTemplate('hominem://collections/{id}', {
        list: () =>
          listEntities(
            scope,
            'list_collections',
            { limit: LIST_LIMIT },
            'collections',
            'hominem://collections/',
            'name',
          ),
        complete: {
          id: (value) =>
            completeIds(scope, 'list_collections', { limit: LIST_LIMIT }, 'collections', value),
        },
      }),
      {
        title: 'Collection',
        description: "A collection's details, items and members.",
        mimeType: JSON_MIME,
      },
      (uri, variables) =>
        readEntity(
          scope,
          uri,
          variables.id,
          'collection_detail',
          (id) => ({ collectionId: id }),
          (data) => !data || data.collection === null,
        ),
    );
  }

  if (canUseTool(scope, 'task_detail') && canUseTool(scope, 'task_list')) {
    mcpServer.registerResource(
      'task',
      new ResourceTemplate('hominem://tasks/{id}', {
        list: () =>
          listEntities(
            scope,
            'task_list',
            { limit: LIST_LIMIT, status: 'pending' },
            'tasks',
            'hominem://tasks/',
            'title',
          ),
        complete: {
          id: (value) =>
            completeIds(
              scope,
              'task_list',
              { limit: LIST_LIMIT, status: 'pending' },
              'tasks',
              value,
            ),
        },
      }),
      {
        title: 'Task',
        description: 'A task or task list with its participants and subtasks.',
        mimeType: JSON_MIME,
      },
      (uri, variables) =>
        readEntity(
          scope,
          uri,
          variables.id,
          'task_detail',
          (id) => ({ id }),
          (data) => !data || data.task === null,
        ),
    );
  }

  if (canUseTool(scope, 'note_get') && canUseTool(scope, 'note_list')) {
    mcpServer.registerResource(
      'note',
      new ResourceTemplate('hominem://notes/{id}', {
        list: () =>
          listEntities(
            scope,
            'note_list',
            { limit: LIST_LIMIT },
            'notes',
            'hominem://notes/',
            'title',
          ),
        complete: {
          id: (value) => completeIds(scope, 'note_list', { limit: LIST_LIMIT }, 'notes', value),
        },
      }),
      {
        title: 'Note',
        description: 'The full content of a note.',
        mimeType: JSON_MIME,
      },
      (uri, variables) =>
        readEntity(
          scope,
          uri,
          variables.id,
          'note_get',
          (id) => ({ id }),
          (data) => !data || data.note === null,
        ),
    );
  }

  if (canUseTool(scope, 'possession_get') && canUseTool(scope, 'possession_list')) {
    mcpServer.registerResource(
      'possession',
      new ResourceTemplate('hominem://possessions/{id}', {
        list: () =>
          listEntities(
            scope,
            'possession_list',
            { limit: LIST_LIMIT },
            'possessions',
            'hominem://possessions/',
            'name',
          ),
        complete: {
          id: (value) =>
            completeIds(scope, 'possession_list', { limit: LIST_LIMIT }, 'possessions', value),
        },
      }),
      {
        title: 'Possession',
        description: 'A possession with its status, pricing, placement and notes.',
        mimeType: JSON_MIME,
      },
      (uri, variables) =>
        readEntity(
          scope,
          uri,
          variables.id,
          'possession_get',
          (id) => ({ id }),
          (data) => !data || data.possession === null,
        ),
    );
  }

  if (canUseTool(scope, 'container_get') && canUseTool(scope, 'container_list')) {
    mcpServer.registerResource(
      'container',
      new ResourceTemplate('hominem://containers/{id}', {
        list: () =>
          listEntities(
            scope,
            'container_list',
            { limit: LIST_LIMIT },
            'containers',
            'hominem://containers/',
            'name',
          ),
        complete: {
          id: (value) =>
            completeIds(scope, 'container_list', { limit: LIST_LIMIT }, 'containers', value),
        },
      }),
      {
        title: 'Container',
        description: 'A container with its child containers and the possessions inside it.',
        mimeType: JSON_MIME,
      },
      (uri, variables) =>
        readEntity(
          scope,
          uri,
          variables.id,
          'container_get',
          (id) => ({ id }),
          (data) => !data || data.container === null,
        ),
    );
  }
}
