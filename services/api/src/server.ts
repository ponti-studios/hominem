import { logger, recordTelemetryException } from '@hominem/telemetry';
import { Scalar } from '@scalar/hono-api-reference';
import { Hono, type MiddlewareHandler } from 'hono';
import { compress } from 'hono/compress';
import { cors } from 'hono/cors';
import { routePath } from 'hono/route';

import { betterAuthServer, createBetterAuthServer } from './auth/better-auth';
import type { AuthContext } from './auth/types';
import { API_BRAND } from './brand';
import { env } from './env';
import type { ApiEnv } from './env.schema';
import { getServiceErrorFailureType, isServiceError } from './errors';
import { createMcpRoutes } from './mcp/routes';
import { createAuthMiddleware } from './middleware/auth';
import { blockMaliciousProbes } from './middleware/block-probes';
import { requestBodyLimit } from './middleware/body-limit';
import { clientIpMiddleware } from './middleware/client-ip';
import { originGuard } from './middleware/origin-guard';
import {
  otpSendLimit,
  rateLimit,
  redisCounter,
  type RateLimitCounter,
} from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { createAuthRoutes } from './routes/auth';
import { billingRoutes } from './routes/billing';
import { creditRoutes } from './routes/credit';
import { imagesRoutes } from './routes/images';
import { legalRoutes } from './routes/legal';
import { createLoginRoutes } from './routes/login';
import { statusRoutes } from './routes/status';
import { rpcApp } from './rpc/app';
import { requestIdMiddleware } from './rpc/middleware/auth';

export type AppEnv = {
  Variables: {
    auth?: AuthContext;
    requestId?: string;
    clientIp?: string;
  };
};

const ALLOWED_CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
const CHATGPT_ORIGINS = ['https://chatgpt.com', 'https://chat.openai.com'];
function createAllowedOrigins(inputEnv = env) {
  return new Set([
    inputEnv.API_URL,
    inputEnv.WEB_URL,
    inputEnv.FINANCE_URL,
    inputEnv.CAREER_URL,
    ...(inputEnv.THAMES_SITE_URL ? [new URL(inputEnv.THAMES_SITE_URL).origin] : []),
    ...CHATGPT_ORIGINS,
  ]);
}

// OAuth discovery/registration endpoints (RFC 8414/9728/7591) get hit by any
// MCP client's own origin (e.g. claude.ai). They don't use cookies, so
// reflecting back whatever origin called us is safe here.
function isPublicMcpAuthPath(path: string) {
  return (
    path.startsWith('/.well-known/') ||
    path.startsWith('/api/auth/.well-known/') ||
    path.startsWith('/api/auth/oauth2/') ||
    path === '/api/auth/jwks'
  );
}

function createCorsMiddleware(inputEnv = env): MiddlewareHandler {
  const allowedOrigins = createAllowedOrigins(inputEnv);

  return cors({
    origin: (origin, c) =>
      isPublicMcpAuthPath(c.req.path)
        ? origin || null
        : allowedOrigins.has(origin || '')
          ? origin
          : null,
    credentials: true,
    allowMethods: ALLOWED_CORS_METHODS,
  });
}

function createAuthHandler(auth: typeof betterAuthServer) {
  return (c: { req: { raw: Request } }) => auth.handler(c.req.raw);
}

function createRootStatusPayload() {
  return {
    status: 'ok',
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

export type ServerDependencies = {
  env: ApiEnv;
  auth: typeof betterAuthServer;
  /** Unset = no rate limiting (tests, local dev); production defaults to Redis. */
  rateLimitCounter?: RateLimitCounter;
};

function registerBaseMiddleware(app: Hono<AppEnv>, dependencies: ServerDependencies) {
  const { env: inputEnv, rateLimitCounter } = dependencies;
  app.get('/healthz', (c) => c.text('ok'));
  app.use('*', originGuard(inputEnv.ORIGIN_SECRET));
  app.use(
    '*',
    clientIpMiddleware({
      originGuardActive: inputEnv.ORIGIN_SECRET.length > 0,
      production: inputEnv.NODE_ENV === 'production',
    }),
  );
  app.use('*', requestIdMiddleware);
  app.use('*', requestBodyLimit());
  app.use('*', blockMaliciousProbes());
  app.use('*', requestLogger());
  app.use('*', compress());
  app.use('*', createCorsMiddleware(dependencies.env));
  app.use('*', securityHeadersMiddleware(dependencies.env));
  app.use('*', createAuthMiddleware(dependencies.auth));

  if (rateLimitCounter) {
    // Global bucket fails open; the auth buckets fail closed (see rate-limit.ts).
    app.use(
      '*',
      rateLimit({ bucket: 'global', limit: 120, windowSec: 60, counter: rateLimitCounter }),
    );
    app.use(
      '/api/auth/*',
      rateLimit({
        bucket: 'auth',
        limit: 30,
        windowSec: 60,
        counter: rateLimitCounter,
        failClosed: true,
      }),
    );
    app.use(
      '/login/send',
      rateLimit({
        bucket: 'login-send',
        limit: 30,
        windowSec: 60,
        counter: rateLimitCounter,
        failClosed: true,
      }),
    );
    app.use(
      '/api/auth/oauth2/register',
      rateLimit({
        bucket: 'oauth-register',
        limit: 5,
        windowSec: 3600,
        counter: rateLimitCounter,
        failClosed: true,
      }),
    );
    app.use('/api/auth/email-otp/send-verification-otp', otpSendLimit(rateLimitCounter));
  }
}

function registerApiRoutes(app: Hono<AppEnv>, dependencies: ServerDependencies) {
  const authHandler = createAuthHandler(dependencies.auth);
  const { mcpRoutes, oauthDiscoveryRoutes } = createMcpRoutes(dependencies);
  const authRoutes = createAuthRoutes(dependencies);
  const loginRoutes = createLoginRoutes(dependencies);

  app.route('/', rpcApp);
  // MCP stays outside the client-facing RPC contract - it's server-only and
  // its Redis-backed code shouldn't leak into mobile typechecking.
  app.route('/api/mcp', mcpRoutes);
  // Has to be mounted at root - RFC 8414 / RFC 9728 require it there.
  app.route('/', oauthDiscoveryRoutes);
  app.route('/', loginRoutes);
  app.route('/', billingRoutes);
  app.route('/', creditRoutes);
  app.route('/', legalRoutes);
  // Our own auth extras go first (session/logout reshape for apps/finance, e2e helpers).
  // Anything under /api/auth/* that doesn't match falls through to Better Auth's catch-all.
  app.route('/api/auth', authRoutes);
  app.route('/api/status', statusRoutes);
  app.on(['GET', 'POST'], '/api/auth', authHandler);
  app.on(['GET', 'POST'], '/api/auth/*', authHandler);
  app.route('/api/images', imagesRoutes);
}

// The Scalar page points at /openapi.json, which nothing serves, and Better Auth's own reference
// page maps every auth endpoint for anyone who asks. Dev-only: nothing in production needs either.
function registerDocumentationRoutes(app: Hono<AppEnv>, inputEnv: ApiEnv) {
  if (inputEnv.NODE_ENV === 'production') return;
  app.get(
    '/docs',
    Scalar({
      theme: 'saturn',
      url: '/openapi.json',
      metaData: {
        title: API_BRAND.api.docsTitle,
      },
      layout: 'classic',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch',
      },
    }),
  );
}

function registerErrorHandlers(app: Hono<AppEnv>) {
  app.onError((err, c) => {
    const statusCode = isServiceError(err) ? err.statusCode : 500;
    if (statusCode >= 500) recordTelemetryException(err);
    logger.error('http_request_failed', {
      method: c.req.method,
      path: routePath(c) || 'unmatched',
      statusCode,
      requestId: c.get('requestId'),
      error: err,
      error_name: err instanceof Error ? err.name : 'unknown',
      failureCategory: isServiceError(err) ? err.code.toLowerCase() : 'unhandled',
      failureType: isServiceError(err)
        ? getServiceErrorFailureType(err)
        : 'request.unhandled_exception',
    });

    if (isServiceError(err)) {
      return Response.json(
        {
          error: err.code.toLowerCase(),
          code: err.code,
          failureType: getServiceErrorFailureType(err),
          message: err.message,
          ...(err.details && { details: err.details }),
        },
        // `isServiceError` already checked statusCode is an integer in [400, 599].
        { status: err.statusCode },
      );
    }

    return c.json(
      {
        error: 'internal_error',
        code: 'INTERNAL_ERROR',
        failureType: 'request.unhandled_exception',
        message: 'An unexpected error occurred',
      },
      500,
    );
  });

  app.notFound((c) => {
    logger.warn('api_request_failed', {
      path: 'unmatched',
      method: c.req.method,
      statusCode: 404,
      failureCategory: 'not_found',
      failureType: 'request.route_not_found',
    });
    return c.text('Not Found', 404);
  });
}

export function createServer(overrides: Partial<ServerDependencies> = {}) {
  const inputEnv = overrides.env ?? env;
  const dependencies: ServerDependencies = {
    env: inputEnv,
    auth: overrides.auth ?? (overrides.env ? createBetterAuthServer(inputEnv) : betterAuthServer),
    rateLimitCounter:
      overrides.rateLimitCounter ?? (inputEnv.NODE_ENV === 'production' ? redisCounter : undefined),
  };
  const app = new Hono<AppEnv>();

  registerBaseMiddleware(app, dependencies);
  registerApiRoutes(app, dependencies);
  app.get('/', (c) => c.json(createRootStatusPayload()));
  registerDocumentationRoutes(app, inputEnv);
  registerErrorHandlers(app);

  return app;
}
