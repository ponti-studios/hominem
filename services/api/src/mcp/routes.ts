import { db, sql } from '@hominem/db';
import { logger } from '@hominem/telemetry';
import { oAuthDiscoveryMetadata, oAuthProtectedResourceMetadata } from 'better-auth/plugins';
import { Hono, type Context, type Next } from 'hono';

import { betterAuthMcpServer } from '../auth/better-auth';
import { env } from '../env';
import { isRateLimited } from './rate-limiter';
import { handleMcpRequestWithSession, type McpHonoEnv } from './server';

// Conditional imports — only register tools whose scope is in MCP_ENABLED_SCOPES
// Use top-level await via ESM (services/api is ESM)
const enabledScopes = new Set(
  (process.env.MCP_ENABLED_SCOPES ?? '')
    .split(',')
    .map((scope: string) => scope.trim())
    .filter(Boolean),
);

if (enabledScopes.size === 0 || enabledScopes.has('career:read')) {
  await import('./tools/career');
}

async function mcpAuthorizationMiddleware(c: Context<McpHonoEnv>, next: Next) {
  const auth = c.get('auth');
  if (!auth) {
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

  // Rate limit check (production only — tests/dev share user IDs and would false-trigger)
  if (process.env.NODE_ENV === 'production' && isRateLimited(auth.userId)) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', code: 'RATE_LIMITED', message: 'Too many requests' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    );
  }

  // Daily cost budget throttle (production only)
  if (process.env.NODE_ENV === 'production') {
    const throttled = await checkCostBudget(auth.userId);
    if (throttled) return throttled;
  }

  return next();
}

const configuredDailyCostBudgetCents = Number.parseInt(
  process.env.MCP_DAILY_COST_BUDGET_CENTS ?? '100',
  10,
);
const DAILY_COST_BUDGET_CENTS = Number.isFinite(configuredDailyCostBudgetCents)
  ? configuredDailyCostBudgetCents
  : 100;
const DAILY_COST_BUDGET_USD = DAILY_COST_BUDGET_CENTS / 100;

async function checkCostBudget(userId: string): Promise<Response | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const row = await sql<{ total_cost_usd: string | null }>`
      SELECT COALESCE(SUM(cost_usd), 0)::text AS total_cost_usd
      FROM app.ai_usage_events
      WHERE owner_userid = ${userId}
        AND feature = 'mcp_tool_call'
        AND createdat >= ${today}::timestamptz
    `.execute(db);

    const total = Number.parseFloat(row.rows[0]?.total_cost_usd ?? '0');
    if (total >= DAILY_COST_BUDGET_USD) {
      return new Response(
        JSON.stringify({
          error: 'cost_budget_exceeded',
          code: 'COST_BUDGET_EXCEEDED',
          message: `Daily AI cost budget of $${(DAILY_COST_BUDGET_CENTS / 100).toFixed(2)} exceeded`,
        }),
        { status: 429, headers: { 'content-type': 'application/json' } },
      );
    }
  } catch (error) {
    logger.warn('[mcp] cost budget check failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Cost budget check is non-fatal — allow invocation if the query fails
  }

  return null;
}

export const mcpRoutes = new Hono<McpHonoEnv>()
  .use('*', mcpAuthorizationMiddleware)
  .all('/', handleMcpRequestWithSession)
  .all('/*', handleMcpRequestWithSession);

/**
 * OAuth discovery routes — mounted at the server root so MCP clients
 * can discover the authorization server without auth.
 */
export const oauthDiscoveryRoutes = new Hono()
  .get('/.well-known/oauth-authorization-server', async (c) => {
    return oAuthDiscoveryMetadata(betterAuthMcpServer)(c.req.raw);
  })
  .get('/.well-known/oauth-protected-resource/*', async (c) => {
    return oAuthProtectedResourceMetadata(betterAuthMcpServer)(c.req.raw);
  })
  .get('/.well-known/oauth-protected-resource', async (c) => {
    return oAuthProtectedResourceMetadata(betterAuthMcpServer)(c.req.raw);
  });
