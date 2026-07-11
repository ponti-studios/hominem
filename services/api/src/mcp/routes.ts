import { Hono } from 'hono';

import { authMiddleware, type AppContext } from '../rpc/middleware/auth';
import { handleMcpRequest } from './server';

// Register domain MCP tools at import time
import './tools/career';

export const mcpRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .all('/', async (c) => handleMcpRequest(c))
  .all('/*', async (c) => handleMcpRequest(c));
