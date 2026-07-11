import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../rpc/middleware/auth';
import { handleMcpRequest } from './server';

export const mcpRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .all('/', async (c) => handleMcpRequest(c))
  .all('/*', async (c) => handleMcpRequest(c));
