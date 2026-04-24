import type { User } from '@hominem/auth/types';
import { logger, LOG_MESSAGES } from '@hominem/telemetry';
import { createHonoTelemetryMiddleware } from '@hominem/telemetry/node';
import { apiReference } from '@scalar/hono-api-reference';
import * as Sentry from '@sentry/node';
import { Hono } from 'hono';
import { openAPIRouteHandler } from 'hono-openapi';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { AuthContextEnvelope } from './auth/types';
import { API_BRAND } from './brand';
import { env } from './env';
import { isServiceError } from './errors';
import { authJwtMiddleware } from './middleware/auth';
import { blockMaliciousProbes } from './middleware/block-probes';
import { requestLogger } from './middleware/request-logger';
import { authRoutes } from './routes/auth';
import { imagesRoutes } from './routes/images';
import { statusRoutes } from './routes/status';
import { rpcApp } from './rpc/app';

export type AppEnv = {
  Variables: {
    userId?: string;
    user?: User;
    auth?: AuthContextEnvelope;
  };
};

export function createServer() {
  const app = new Hono<AppEnv>();
  const allowedOrigins = new Set([env.API_URL, env.WEB_URL]);

  app.use('*', blockMaliciousProbes());

  app.use('*', createHonoTelemetryMiddleware());

  app.use('*', requestLogger());

  app.use('*', prettyJSON());

  app.use(
    '*',
    cors({
      origin: (origin) => {
        return allowedOrigins.has(origin || '') ? origin : null;
      },
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    }),
  );

  app.use('*', authJwtMiddleware());
  app.route('/', rpcApp);

  app.route('/api/status', statusRoutes);
  app.route('/api/auth', authRoutes);
  app.route('/api/images', imagesRoutes);

  app.get('/', (c) => {
    return c.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  app.get(
    '/openapi.json',
    openAPIRouteHandler(app, {
      documentation: {
        openapi: '3.1.0',
        info: {
          title: API_BRAND.api.title,
          version: '1.0.0',
          description: API_BRAND.api.description,
          contact: {
            name: API_BRAND.api.contactName,
            email: 'code@hominem.io',
          },
        },
        servers: [
          {
            url: env.API_URL,
            description: 'Production API server',
          },
          ...(env.NODE_ENV !== 'production'
            ? [
                {
                  url: 'http://localhost:4040',
                  description: 'Local development server',
                },
              ]
            : []),
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT token for authentication',
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    }),
  );

  app.get(
    '/docs',
    apiReference({
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

  app.onError((err, c) => {
    Sentry.captureException(err);
    logger.error('[services/api] Error', { error: err });

    if (isServiceError(err)) {
      return c.json(
        {
          error: err.code.toLowerCase(),
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details }),
        },
        err.statusCode as ContentfulStatusCode,
      );
    }

    return c.json(
      {
        error: 'internal_error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      500,
    );
  });

  app.notFound((c) => {
    logger.warn(LOG_MESSAGES.ROUTE_NOT_FOUND, {
      path: c.req.path,
      method: c.req.method,
      userAgent: c.req.header('user-agent'),
    });
    return c.text('Not Found', 404);
  });

  return app;
}
