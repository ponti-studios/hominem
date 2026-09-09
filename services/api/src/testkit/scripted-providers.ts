import { isObject } from '@hominem/utils';
import { appendScriptedMailboxRecord } from '@hominem/utils/scripted-mailbox';
import { Dispatcher, getGlobalDispatcher, setGlobalDispatcher } from 'undici';

// Single owner of every scripted external-provider response (OpenRouter,
// Resend) for ENV=scripted, at the undici dispatcher level.
//
// Why one dispatcher and not one MSW `setupServer()` per provider: MSW's
// interceptors never see requests made by @openrouter/sdk's default fetcher
// on this stack — verified empirically, even `onUnhandledRequest: 'error'`
// never fired, meaning MSW's patch was never reached at all. Separately,
// running two independent `setupServer()` instances (one per provider) is a
// documented MSW footgun: each patches the same shared global fetch/http
// hooks, and the second `.listen()` can silently orphan the first's
// interceptor rather than compose with it — which is exactly what happened
// here (Resend, installed second, worked; OpenRouter, installed first,
// didn't). A single dispatcher with a small route table sidesteps both
// problems: it's the mechanism undici's own fetch() actually calls through
// to (confirmed by reading its `dispatch` helper), and there is structurally
// only one thing that can ever own the global dispatcher slot, so a second
// install can't orphan a first one — every caller shares the same instance
// and the same install/teardown lifecycle.

// ============================================================================
// OpenRouter: deterministic chat-completion responses
// ============================================================================

type OpenRouterMessage = {
  role?: string;
  content?: unknown;
};

type OpenRouterRequest = {
  messages?: OpenRouterMessage[];
  response_format?: unknown;
  stream?: boolean;
  tools?: Array<{ function?: { name?: string } }>;
};

type ScriptedContext = {
  request: OpenRouterRequest;
  toolNames: Set<string>;
  userText: string;
  hasToolResult: boolean;
  hasRejectedToolResult: boolean;
  hasFailedToolResult: boolean;
};

type ScriptedRule<T> = {
  matches: (context: ScriptedContext) => boolean;
  resolve: (context: ScriptedContext) => T;
};

let requestNumber = 0;
const failedProviderRequests = new Set<string>();
const CONTROLLED_DELAY_MS = 750;

function hasControl(userText: string, control: string) {
  return new RegExp(`\\b${control}\\b`, 'i').test(userText);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function sse(value: unknown) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function firstMatchingRule<T>(rules: readonly ScriptedRule<T>[], context: ScriptedContext): T {
  const rule = rules.find((candidate) => candidate.matches(context));
  if (!rule) throw new Error('No scripted provider rule matched');
  return rule.resolve(context);
}

function createContext(request: OpenRouterRequest): ScriptedContext {
  const messages = request.messages ?? [];
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  return {
    request,
    toolNames: new Set(
      (request.tools ?? [])
        .map((tool) => tool.function?.name)
        .filter((name): name is string => Boolean(name)),
    ),
    hasToolResult: messages.some((message) => message.role === 'tool'),
    hasRejectedToolResult: messages.some(
      (message) => message.role === 'tool' && /rejected/i.test(String(message.content ?? '')),
    ),
    hasFailedToolResult: messages.some(
      (message) => message.role === 'tool' && /error/i.test(String(message.content ?? '')),
    ),
    userText: typeof latestUserMessage?.content === 'string' ? latestUserMessage.content : '',
  };
}

const toolNameRules: readonly ScriptedRule<string | null>[] = [
  {
    matches: ({ hasToolResult }) => hasToolResult,
    resolve: () => null,
  },
  {
    matches: ({ toolNames, userText }) =>
      toolNames.has('create_collection') &&
      /collection/i.test(userText) &&
      !/\b(list|show)\b/i.test(userText),
    resolve: () => 'create_collection',
  },
  {
    matches: ({ toolNames, userText }) =>
      toolNames.has('list_collections') && /list|show/i.test(userText),
    resolve: () => 'list_collections',
  },
  { matches: () => true, resolve: () => null },
];

const contentRules: readonly ScriptedRule<string>[] = [
  {
    matches: ({ hasRejectedToolResult }) => hasRejectedToolResult,
    resolve: () => 'The tool request was rejected.',
  },
  {
    matches: ({ hasFailedToolResult }) => hasFailedToolResult,
    resolve: () => 'The tool request failed.',
  },
  {
    matches: ({ hasToolResult, userText }) => hasToolResult && /TOOL-B006-READY/i.test(userText),
    resolve: () => 'TOOL-B006-READY',
  },
  {
    matches: ({ hasToolResult }) => hasToolResult,
    resolve: () => 'The collection was created successfully.',
  },
  {
    matches: ({ userText }) => /\b(reject|rejected|deny|denied)\b/i.test(userText),
    resolve: () => 'The tool request was rejected.',
  },
  {
    matches: () => true,
    resolve: ({ userText }) => `Scripted response: ${userText || 'Ready.'}`,
  },
];

function openRouterResponseBody(request: OpenRouterRequest) {
  const context = createContext(request);
  const toolName = firstMatchingRule(toolNameRules, context);
  const shouldFailTool = /TOOL-B009-FAIL/i.test(context.userText);
  const id = `scripted-${++requestNumber}`;
  const toolCall = {
    index: 0,
    id: `scripted-call-${requestNumber}`,
    type: 'function',
    function: {
      name: toolName ?? 'create_collection',
      arguments: shouldFailTool
        ? '{invalid'
        : toolName === 'list_collections'
          ? '{}'
          : JSON.stringify({
              description: 'Created by the local scripted provider',
              name: 'Browser scripted provider collection',
              visibility: 'private',
            }),
    },
  };
  const content = firstMatchingRule(contentRules, context);
  const isStructured = request.response_format !== undefined;
  const responseContent = isStructured
    ? JSON.stringify({
        capabilities: ['collections'],
        requiresLookup: /collection/i.test(context.userText),
      })
    : content;
  const isInitialConfirmationRejection =
    /B008-OMIRO-CONFIRM-REJECT/i.test(context.userText) && !context.hasToolResult;
  const isRejectedRequest = /\b(reject|rejected|deny|denied)\b/i.test(context.userText);
  const delta =
    toolName && (!isRejectedRequest || isInitialConfirmationRejection)
      ? { tool_calls: [toolCall] }
      : { content };
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'hominem/scripted-chat',
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
      cost: 0,
    },
    choices: [{ index: 0, delta, finish_reason: null }],
  };

  if (!request.stream) {
    return JSON.stringify({
      ...payload,
      object: 'chat.completion',
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            ...(isStructured ? { content: responseContent } : delta),
          },
          finish_reason: 'stop',
        },
      ],
    });
  }

  return `${sse(payload)}${sse({
    ...payload,
    choices: [{ ...payload.choices[0], delta: {}, finish_reason: 'stop' }],
  })}data: [DONE]\n\n`;
}

async function openRouterResponder(rawBody: string): Promise<ScriptedResponse> {
  const body = (rawBody ? JSON.parse(rawBody) : {}) as OpenRouterRequest;
  const userText = (body.messages ?? [])
    .filter((message) => message.role === 'user')
    .map((message) => (typeof message.content === 'string' ? message.content : ''))
    .join('\n');
  const failureMarker = userText.match(/PROVIDER-B010-FAIL(?:-[A-Z0-9]+)?/i)?.[0].toUpperCase();
  if (!body.response_format && failureMarker && !failedProviderRequests.has(failureMarker)) {
    failedProviderRequests.add(failureMarker);
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      frames: [
        { data: JSON.stringify({ error: { code: 400, message: 'Scripted provider failure' } }) },
      ],
    };
  }

  const response = openRouterResponseBody(body);
  const controlledStream =
    body.stream &&
    ['B012-STREAM', 'B013-DISCONNECT', 'B014-REPLAY', 'B017-ACTIVE-RELOAD'].some((control) =>
      hasControl(userText, control),
    );
  const delayBeforeMs =
    body.stream && hasControl(userText, 'B011-CANCEL-BEFORE') ? CONTROLLED_DELAY_MS * 12 : 0;
  const headers = { 'content-type': body.stream ? 'text/event-stream' : 'application/json' };

  if (!controlledStream) {
    return {
      status: 200,
      headers,
      frames: [{ data: response, delayMsBefore: delayBeforeMs }],
    };
  }

  const frameDelayMs = ['B013-DISCONNECT', 'B014-REPLAY', 'B017-ACTIVE-RELOAD'].some((control) =>
    hasControl(userText, control),
  )
    ? CONTROLLED_DELAY_MS * 2
    : CONTROLLED_DELAY_MS;
  const frames = response
    .split('\n\n')
    .filter(Boolean)
    .map((frame, index) => ({
      data: `${frame}\n\n`,
      delayMsBefore: index === 0 ? delayBeforeMs : frameDelayMs,
    }));
  return { status: 200, headers, frames };
}

// ============================================================================
// Resend: scripted email capture (OTP extraction, optional mailbox file)
// ============================================================================

type ScriptedEmail = {
  to: string;
  subject: string;
  text: string;
  otp: string | null;
  capturedAt: Date;
};

const capturedEmails = new Map<string, ScriptedEmail>();
let mailboxFile: string | null = null;

function extractOtp(text: string): string | null {
  return text.match(/verification code is: (\d{6})/i)?.[1] ?? null;
}

function isResendEmailBody(
  value: unknown,
): value is { to: string | string[]; subject: string; text: string } {
  if (!isObject(value)) return false;
  const to = Reflect.get(value, 'to');
  return (
    (typeof to === 'string' ||
      (Array.isArray(to) && to.every((item) => typeof item === 'string'))) &&
    typeof Reflect.get(value, 'subject') === 'string' &&
    typeof Reflect.get(value, 'text') === 'string'
  );
}

async function resendResponder(rawBody: string): Promise<ScriptedResponse> {
  const body: unknown = rawBody ? JSON.parse(rawBody) : null;
  if (!isResendEmailBody(body)) {
    return {
      status: 400,
      headers: { 'content-type': 'application/json' },
      frames: [{ data: JSON.stringify({ error: 'Invalid scripted email body' }) }],
    };
  }
  const to = Array.isArray(body.to) ? body.to[0] : body.to;
  if (to) {
    const otp = extractOtp(body.text ?? '');
    capturedEmails.set(to, {
      to,
      subject: body.subject,
      text: body.text,
      otp,
      capturedAt: new Date(),
    });
    // Defense in depth behind index.ts refusing scripted+production at
    // boot: the mailbox only ever exists on non-production hosts.
    if (mailboxFile && process.env.NODE_ENV !== 'production' && otp) {
      appendScriptedMailboxRecord(mailboxFile, { to, otp, subject: body.subject });
    }
  }
  return {
    status: 200,
    headers: { 'content-type': 'application/json' },
    frames: [{ data: JSON.stringify({ id: `scripted-email-${capturedEmails.size}` }) }],
  };
}

export function getScriptedEmail(to: string): ScriptedEmail | null {
  return capturedEmails.get(to) ?? null;
}

// ============================================================================
// Shared undici dispatcher
// ============================================================================

type ScriptedResponse = {
  status: number;
  headers: Record<string, string>;
  frames: Array<{ data: string; delayMsBefore?: number }>;
};

type Route = {
  origin: string;
  path: string;
  method: string;
  responder: (rawBody: string) => Promise<ScriptedResponse>;
};

const OPENROUTER_ROUTE: Route = {
  origin: 'https://openrouter.ai',
  path: '/api/v1/chat/completions',
  method: 'POST',
  responder: openRouterResponder,
};

const RESEND_ROUTE: Route = {
  origin: 'https://api.resend.com',
  path: '/emails',
  method: 'POST',
  responder: resendResponder,
};

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
};

async function readDispatchBody(body: unknown): Promise<string> {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  if (typeof (body as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array | string));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return '';
}

function rawHeaderPairs(headers: Record<string, string>): Buffer[] {
  return Object.entries(headers).flatMap(([name, value]) => [
    Buffer.from(name),
    Buffer.from(value),
  ]);
}

class ScriptedProvidersDispatcher extends Dispatcher {
  constructor(
    private readonly fallback: Dispatcher,
    private readonly routes: readonly Route[],
  ) {
    super();
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    const origin = typeof options.origin === 'string' ? options.origin : options.origin?.toString();
    const route = this.routes.find(
      (candidate) =>
        candidate.origin === origin &&
        candidate.path === options.path &&
        candidate.method === options.method,
    );
    if (!route) {
      return this.fallback.dispatch(options, handler);
    }
    void this.serve(route, options, handler);
    return true;
  }

  private async serve(
    route: Route,
    options: Dispatcher.DispatchOptions,
    handler: Dispatcher.DispatchHandler,
  ): Promise<void> {
    try {
      handler.onConnect?.(() => undefined);
      const rawBody = await readDispatchBody(options.body);
      const { status, headers, frames } = await route.responder(rawBody);
      handler.onHeaders?.(
        status,
        rawHeaderPairs(headers),
        () => undefined,
        STATUS_TEXT[status] ?? '',
      );
      for (const frame of frames) {
        if (frame.delayMsBefore) await wait(frame.delayMsBefore);
        handler.onData?.(Buffer.from(frame.data));
      }
      handler.onComplete?.(null);
    } catch (error) {
      handler.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  close(...args: Parameters<Dispatcher['close']>) {
    return this.fallback.close(...args);
  }

  destroy(...args: Parameters<Dispatcher['destroy']>) {
    return this.fallback.destroy(...args);
  }
}

let installedFallback: Dispatcher | null = null;

export function installScriptedProviders(
  options: { ai?: boolean; email?: boolean; mailboxFile?: string } = {},
): () => void {
  const routes: Route[] = [];
  if (options.ai) {
    failedProviderRequests.clear();
    routes.push(OPENROUTER_ROUTE);
  }
  if (options.email) {
    capturedEmails.clear();
    mailboxFile = options.mailboxFile ?? null;
    routes.push(RESEND_ROUTE);
  }
  if (routes.length === 0) {
    return () => undefined;
  }

  installedFallback = getGlobalDispatcher();
  setGlobalDispatcher(new ScriptedProvidersDispatcher(installedFallback, routes));
  return () => {
    if (installedFallback) setGlobalDispatcher(installedFallback);
    installedFallback = null;
    mailboxFile = null;
  };
}
