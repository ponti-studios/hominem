import { requireMcpAuth } from '@better-auth/mcp';
import { createInsufficientScopeError } from 'better-auth/oauth2';
import { Hono, type Context, type Next } from 'hono';

import { MCP_TOKEN_PREFIX, resolveMcpToken } from '../application/mcp-tokens.service';
import { betterAuthServer } from '../auth/better-auth';
import { env } from '../env';
import { setMcpAuthContext } from '../middleware/auth';
import { MCP_SCOPES } from '../scopes';
import { checkRateLimit } from './rate-limiter';
import { ensureMcpToolsRegistered } from './register-tools';
import { handleMcpRequest, type McpHonoEnv } from './server';

// Top-level await works fine here since services/api is ESM
await ensureMcpToolsRegistered();

type McpDependencies = {
  env: typeof env;
  auth: typeof betterAuthServer;
};

function createMcpAuthorizationMiddleware(dependencies: McpDependencies) {
  const { env: inputEnv, auth } = dependencies;

  // Shared by both auth paths: once a caller identity is resolved, authorize
  // scopes, rate-limit in production, then run the route.
  const runAuthorizedRequest = async (c: Context<McpHonoEnv>, next: Next) => {
    const auth = c.get('auth');
    if (!auth || !MCP_SCOPES.some((scope) => auth.scopes.includes(scope))) {
      throw createInsufficientScopeError([...MCP_SCOPES]);
    }

    if (inputEnv.NODE_ENV === 'production') {
      const rateLimitResult = await checkRateLimit(auth.userId);
      if (rateLimitResult === 'unavailable') {
        return new Response(JSON.stringify({ error: 'rate_limit_unavailable' }), {
          status: 503,
          headers: { 'content-type': 'application/json', 'retry-after': '5' },
        });
      }
      if (rateLimitResult === 'limited') {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    await next();
    return c.res;
  };

  const unauthorized = () =>
    new Response(JSON.stringify({ error: 'invalid_token' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });

  return async (c: Context<McpHonoEnv>, next: Next) => {
    const bearer = c.req.header('authorization') ?? '';
    const rawToken = bearer.replace(/^Bearer\s+/i, '').trim();

    // Personal `hmt_` tokens bypass the OAuth flow: resolved straight to the
    // owning user and their token's scope allow-list (empty = all scopes).
    if (rawToken.startsWith(MCP_TOKEN_PREFIX)) {
      const resolved = await resolveMcpToken(rawToken);
      if (!resolved) return unauthorized();
      const scopes = resolved.scopes.length > 0 ? resolved.scopes : [...MCP_SCOPES];
      const claims = {
        sub: resolved.ownerUserId,
        scope: scopes.join(' '),
        client_id: 'hominem-mcp-token',
      };
      if (!(await setMcpAuthContext(c, claims, 'mcp-token'))) return unauthorized();
      return runAuthorizedRequest(c, next);
    }

    const verifiedHandler = requireMcpAuth(
      auth,
      async (_request, claims) => {
        if (!(await setMcpAuthContext(c, claims))) return unauthorized();
        return runAuthorizedRequest(c, next);
      },
      {
        resource: new URL('/api/mcp', inputEnv.API_URL).toString(),
        issuer: new URL('/api/auth', inputEnv.API_URL).toString(),
        challengeScopes: [...MCP_SCOPES],
      },
    );

    return verifiedHandler(c.req.raw);
  };
}

export const mcpAuthorizationMiddleware = createMcpAuthorizationMiddleware({
  env,
  auth: betterAuthServer,
});

export function createMcpRoutes(dependencies: McpDependencies) {
  const { env: inputEnv, auth } = dependencies;
  const mcpAuthorizationMiddleware = createMcpAuthorizationMiddleware(dependencies);

  const mcpRoutes = new Hono<McpHonoEnv>()
    .use('*', mcpAuthorizationMiddleware)
    .all('/', handleMcpRequest)
    .all('/*', handleMcpRequest);

  // OAuth discovery routes, mounted at the server root so MCP clients can
  // find the authorization server without needing to auth first.
  const mcpResource = new URL('/api/mcp', inputEnv.API_URL).toString();

  const getOAuthProtectedResourceResponse = (c: Context) => {
    return c.json({
      resource: mcpResource,
      authorization_servers: [new URL('/api/auth', inputEnv.API_URL).toString()],
      bearer_methods_supported: ['header'],
      scopes_supported: [...MCP_SCOPES],
    });
  };

  async function handleOAuthAuthorizationServerMetadata(c: Context) {
    if (c.req.method === 'HEAD') {
      // ChatGPT does a HEAD request before the real GET. Better Auth's HEAD
      // response has no body, so parsing it would 500 and hide real capabilities.
      return new Response(null, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const authUrl = new URL(c.req.url);
    authUrl.pathname = '/api/auth/.well-known/oauth-authorization-server';
    const response = await auth.handler(
      new Request(authUrl, { method: c.req.method, headers: c.req.raw.headers }),
    );
    const metadata: Record<string, unknown> = await response.json();

    return c.json({
      ...metadata,
      authorization_response_iss_parameter_supported: false,
    });
  }

  const oauthDiscoveryRoutes = new Hono()
    .get('/.well-known/openai-apps-challenge', (c) => {
      if (!inputEnv.OPENAI_APPS_CHALLENGE) {
        return c.json({ error: 'OpenAI Apps challenge is not configured' }, 404);
      }
      return c.text(inputEnv.OPENAI_APPS_CHALLENGE);
    })
    .get('/.well-known/oauth-authorization-server', (c) =>
      handleOAuthAuthorizationServerMetadata(c),
    )
    .get('/.well-known/oauth-authorization-server/*', (c) =>
      handleOAuthAuthorizationServerMetadata(c),
    )
    .get('/api/auth/.well-known/oauth-authorization-server', (c) =>
      handleOAuthAuthorizationServerMetadata(c),
    )
    .get('/.well-known/oauth-protected-resource', (c) => {
      return getOAuthProtectedResourceResponse(c);
    })
    .get('/.well-known/oauth-protected-resource/*', getOAuthProtectedResourceResponse);

  return { mcpRoutes, oauthDiscoveryRoutes };
}

export const { mcpRoutes, oauthDiscoveryRoutes } = createMcpRoutes({
  env,
  auth: betterAuthServer,
});
