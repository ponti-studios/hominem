import type { Hono } from 'hono';

import type { AppContext, RpcUser } from '../../rpc/middleware/auth';
import { createRpcTestApp } from '../rpc-test-app';
import { makeRpcUser } from './time-block';

export const FINANCE_ROUTE_USER_ID = '11111111-1111-4111-8111-111111111111';

export function financeRpcUser(id: string = FINANCE_ROUTE_USER_ID): RpcUser {
  return makeRpcUser({ id, email: `${id}@test.hominem.dev`, name: 'Finance Route Test User' });
}

/** A finance route mounted at its real path, already signed in as `userId`. */
export function financeTestApp(
  area: 'accounts' | 'transactions',
  route: Hono<AppContext>,
  userId?: string,
) {
  return createRpcTestApp(route, { path: `/api/finance/${area}`, user: financeRpcUser(userId) });
}
