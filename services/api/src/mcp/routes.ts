import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { Hono } from 'hono';

import { betterAuthServer } from '../auth/better-auth';
import { env } from '../env';
import { handleMcpRequestWithSession } from './server';
// Register domain MCP tools at import time
import './tools/career';

/**
 * MCP middleware — validates access tokens via Better Auth's MCP plugin.
 * Falls back to existing session auth (cookies, x-user-id) for dev/test.
 */
async function mcpAuthMiddleware(c: any, next: () => Promise<void>) {
  // First try MCP plugin session (OAuth access token)
  const mcpSession = await (betterAuthServer.api as any).getMcpSession({
    headers: c.req.raw.headers,
  });

  if (mcpSession) {
    c.set('userId', mcpSession.userId);
    c.set('mcpSession', mcpSession);
    return next();
  }

  // Fallback: existing session auth (Bearer token, cookies, x-user-id)
  const userId = c.get('userId');
  if (userId) {
    return next();
  }

  // Fallback: non-prod proxy user header
  if (process.env.NODE_ENV !== 'production') {
    const proxyUserId = c.req.header('x-user-id');
    if (proxyUserId) {
      c.set('userId', proxyUserId);
      c.set('mcpSession', { userId: proxyUserId, scopes: '' });
      return next();
    }
  }

  const resourceMetadataUrl = new URL(
    '/.well-known/oauth-protected-resource/api/mcp',
    env.API_URL,
  ).toString();

  return new Response(
    JSON.stringify({
      error: 'unauthorized',
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    }),
    {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'WWW-Authenticate': `Bearer realm="Hominem", resource_metadata="${resourceMetadataUrl}"`,
      },
    },
  );
}

export const mcpRoutes = new Hono()
  .use('*', mcpAuthMiddleware)
  .all('/', async (c) => handleMcpRequestWithSession(c as any))
  .all('/*', async (c) => handleMcpRequestWithSession(c as any));

/**
 * OAuth discovery routes — mounted at the server root so MCP clients
 * can discover the authorization server without auth.
 */
export const oauthDiscoveryRoutes = new Hono()
  .get('/.well-known/oauth-authorization-server', async (c) => {
    return oAuthDiscoveryMetadata(betterAuthServer as any)(c.req.raw);
  })
  // Wildcard: matches /.well-known/oauth-protected-resource + optional resource path
  .get('/.well-known/oauth-protected-resource/*', async (c) => {
    return oAuthProtectedResourceMetadata(betterAuthServer as any)(c.req.raw);
  })
  .get('/.well-known/oauth-protected-resource', async (c) => {
    return oAuthProtectedResourceMetadata(betterAuthServer as any)(c.req.raw);
  });
