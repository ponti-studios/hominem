import { Hono } from 'hono';

import type { AppContext, RpcUser } from '../rpc/middleware/auth';
import { requestIdMiddleware } from '../rpc/middleware/auth';
import { apiErrorHandler } from '../rpc/middleware/error';
import { validationErrorMiddleware } from '../rpc/middleware/validation';

export function createRpcTestApp(
  route: Hono<AppContext>,
  options: {
    authenticated?: boolean;
    path: string;
    user: RpcUser;
  },
) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use(requestIdMiddleware)
    .use(validationErrorMiddleware);

  if (options.authenticated ?? true) {
    app.use('*', async (c, next) => {
      c.set('auth', {
        user: options.user,
        userId: options.user.id,
        credential: 'session',
        scopes: [],
      });
      await next();
    });
  }

  return app.route(options.path, route);
}

function sendJson(app: Hono<AppContext>, method: string, path: string, body: unknown) {
  return app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postJson(app: Hono<AppContext>, path: string, body: unknown) {
  return sendJson(app, 'POST', path, body);
}

export function patchJson(app: Hono<AppContext>, path: string, body: unknown) {
  return sendJson(app, 'PATCH', path, body);
}
