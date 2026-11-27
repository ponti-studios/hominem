import { Hono } from 'hono';

import type { AppContext } from '../../rpc/middleware/auth';
import { apiErrorHandler } from '../../rpc/middleware/error';
import { financeRoutes } from '../../rpc/routes/finance';
import { financeRpcUser } from './finance-rpc';

/**
 * The whole finance router where each request picks its caller by header, so one app can cover
 * signed-out, owner and stranger. Omit the key to stay signed out.
 */
export function financeCallerApp(callers: Record<string, string>) {
  const app = new Hono<AppContext>()
    .onError(apiErrorHandler)
    .use('*', async (c, next) => {
      const userId = callers[c.req.header('x-finance-caller') ?? ''];
      if (userId) {
        c.set('auth', {
          user: financeRpcUser(userId),
          userId,
          credential: 'session',
          scopes: [],
        });
      }
      await next();
    })
    .route('/api/finance', financeRoutes);

  return (path: string, body: unknown, caller?: string) =>
    app.request(`/api/finance/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(caller ? { 'x-finance-caller': caller } : {}),
      },
      body: JSON.stringify(body),
    });
}
