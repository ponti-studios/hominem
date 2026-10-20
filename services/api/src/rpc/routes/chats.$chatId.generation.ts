import { ChatHttpClientError, createGenerationSseResponse } from '@hominem/chat/server';
import { logger } from '@hominem/telemetry';
import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';

import {
  ChatGenerationInputError,
  chatGenerationService,
} from '../../chat/chat-generation.service';
import type { ChatGenerationService } from '../../chat/chat-generation.service';
import {
  ChatsRegenerateMessageSchema,
  ChatsRetryGenerationSchema,
  ChatsSendSchema,
  ChatsStartStreamSchema,
  ChatsToolCallRespondSchema,
} from '../../schemas/chats.schema';
import type { AppContext } from '../middleware/auth';

function chatErrorMetadata(error: unknown) {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const errorCategory =
    errorName === 'ChatHttpClientError'
      ? 'client_safe'
      : errorName === 'ChatGenerationInputError'
        ? 'client_input'
        : /provider|openrouter/i.test(errorName)
          ? 'provider'
          : /validation|zod/i.test(errorName)
            ? 'validation'
            : 'internal';
  const failureType =
    error instanceof ChatHttpClientError && error.code === 'UNSUPPORTED_CAPABILITY'
      ? 'chat.request.unsupported_capability'
      : errorCategory === 'client_input'
        ? 'chat.request.invalid_input'
        : errorCategory === 'provider'
          ? 'chat.request.provider_failed'
          : errorCategory === 'validation'
            ? 'chat.request.validation_failed'
            : errorCategory === 'client_safe'
              ? 'chat.request.rejected'
              : 'chat.request.failed';
  return { errorCategory, errorName, failureType };
}

function failedResponse(error: unknown): Response {
  if (error instanceof Response) return error;
  if (error instanceof ChatHttpClientError) {
    return Response.json(
      {
        error: error.clientMessage,
        code: error.code,
        failureType: chatErrorMetadata(error).failureType,
      },
      { status: error.statusCode },
    );
  }
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined;
  return Response.json(
    {
      error: 'Chat request failed',
      code: 'CHAT_REQUEST_FAILED',
      failureType: chatErrorMetadata(error).failureType,
    },
    { status: typeof statusCode === 'number' ? statusCode : 500 },
  );
}

function handleRoute(
  c: Context<AppContext>,
  operation: () => Promise<Response>,
): Promise<Response> {
  const request = c.req.raw;
  const requestId = c.get('requestId');
  return operation().catch((error: unknown) => {
    logger.error('chat_http_handler_error', {
      operation: 'chat.request',
      method: request.method,
      path: new URL(request.url).pathname,
      requestId,
      ...chatErrorMetadata(error),
    });
    if (error instanceof ChatGenerationInputError) {
      return Response.json(
        {
          error: 'validation_error',
          code: 'VALIDATION_ERROR',
          failureType: 'chat.request.invalid_input',
          message: error.message,
        },
        { status: 400 },
      );
    }
    return failedResponse(error);
  });
}

function readCursor(c: Context<AppContext>): number {
  const value = c.req.header('Last-Event-ID') ?? c.req.query('afterSequence') ?? '0';
  if (!/^\d+$/.test(value)) throw new ChatGenerationInputError('Invalid generation event cursor');
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor)) {
    throw new ChatGenerationInputError('Invalid generation event cursor');
  }
  return cursor;
}

function createGenerationRoutes(service: ChatGenerationService) {
  return new Hono<AppContext>()
    .get('/generations/:generationId', (c) =>
      handleRoute(c, async () => {
        const run = await service.getGeneration({
          chatId: c.req.param('id')!,
          generationId: c.req.param('generationId'),
          ownerUserId: c.get('auth')!.userId,
        });
        if (!run) {
          return Response.json(
            {
              error: 'not_found',
              code: 'NOT_FOUND',
              failureType: 'chat.generation.not_found',
              message: 'Generation run not found',
            },
            { status: 404 },
          );
        }
        return Response.json(run);
      }),
    )
    .get('/generations/:generationId/stream', (c) =>
      handleRoute(c, async () => {
        const generationId = c.req.param('generationId');
        const ownerUserId = c.get('auth')!.userId;
        const run = await service.getGeneration({
          chatId: c.req.param('id')!,
          generationId,
          ownerUserId,
        });
        if (!run) {
          return Response.json(
            {
              error: 'not_found',
              code: 'NOT_FOUND',
              failureType: 'chat.generation.not_found',
              message: 'Generation run not found',
            },
            { status: 404 },
          );
        }
        return createGenerationSseResponse(
          await service.replay({
            generationId,
            ownerUserId,
            afterSequence: readCursor(c),
            terminal: ['committed', 'cancelled', 'failed'].includes(run.status),
          }),
        );
      }),
    )
    .post('/generations/:generationId/cancel', (c) =>
      handleRoute(c, async () =>
        Response.json(
          await service.cancel({
            ownerUserId: c.get('auth')!.userId,
            chatId: c.req.param('id')!,
            generationId: c.req.param('generationId'),
          }),
        ),
      ),
    )
    .post(
      '/generations/:generationId/regenerate',
      zValidator('json', ChatsRetryGenerationSchema),
      (c) =>
        handleRoute(c, async () =>
          createGenerationSseResponse(
            await service.regenerate({
              userId: c.get('auth')!.userId,
              chatId: c.req.param('id')!,
              failedGenerationId: c.req.param('generationId'),
              ...c.req.valid('json'),
            }),
          ),
        ),
    )
    .post(
      '/messages/:messageId/regenerate',
      zValidator('json', ChatsRegenerateMessageSchema),
      (c) =>
        handleRoute(c, async () =>
          createGenerationSseResponse(
            await service.regenerate({
              userId: c.get('auth')!.userId,
              chatId: c.req.param('id')!,
              messageId: c.req.param('messageId'),
              ...c.req.valid('json'),
            }),
          ),
        ),
    )
    .post(
      '/messages/:messageId/tool-calls/:toolCallId/respond',
      zValidator('json', ChatsToolCallRespondSchema),
      (c) =>
        handleRoute(c, async () =>
          createGenerationSseResponse(
            await service.respondToConfirmation({
              userId: c.get('auth')!.userId,
              chatId: c.req.param('id')!,
              messageId: c.req.param('messageId'),
              toolCallId: c.req.param('toolCallId'),
              ...c.req.valid('json'),
            }),
          ),
        ),
    )
    .post('/stream', zValidator('json', ChatsSendSchema), (c) =>
      handleRoute(c, async () => {
        const input = c.req.valid('json');
        return createGenerationSseResponse(
          await service.sendMessage({
            userId: c.get('auth')!.userId,
            chatId: c.req.param('id')!,
            ...input,
            fileIds: input.fileIds ?? [],
          }),
        );
      }),
    );
}

export function createChatGenerationRoutes(service: ChatGenerationService = chatGenerationService) {
  return createGenerationRoutes(service);
}

export function createChatStartGenerationRoute(
  service: ChatGenerationService = chatGenerationService,
) {
  return new Hono<AppContext>().post('/', zValidator('json', ChatsStartStreamSchema), (c) =>
    handleRoute(c, async () => {
      const input = c.req.valid('json');
      return createGenerationSseResponse(
        await service.startMessage({
          userId: c.get('auth')!.userId,
          ...input,
          fileIds: input.fileIds ?? [],
        }),
      );
    }),
  );
}

export const chatGenerationRoutes = createChatGenerationRoutes();
export const chatStartGenerationRoute = createChatStartGenerationRoute();
