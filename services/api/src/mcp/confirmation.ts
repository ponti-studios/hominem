import { createHmac } from 'node:crypto';

import { isObject } from '@hominem/utils';
import {
  CLIENT_CAPABILITIES_META_KEY,
  createRequestStateCodec,
  type ServerContext,
} from '@modelcontextprotocol/server';

import { env } from '../env';

export interface ConfirmationState {
  tool: string;
  args: unknown;
}

// The argument a client repeats back to complete a confirmed call. Advertised on
// every requiresConfirmation tool's input schema (see server.ts) so strict
// clients, which drop arguments the schema does not declare, can send it.
export const CONFIRM_TOKEN_KEY = 'confirmToken';

// Derived from the existing BETTER_AUTH_SECRET (min 32 chars, see env.schema.ts)
// instead of a new secret: this key only needs to be stable across a process's
// lifetime, and BETTER_AUTH_SECRET is already documented (services/api/AGENTS.md)
// as sensitive and rarely rotated, so the confirmation codec rotates in lockstep
// with it rather than needing its own provisioning and rotation story.
const key = createHmac('sha256', env.BETTER_AUTH_SECRET).update('mcp.requestState.v1').digest();

// Binds a minted confirmation token to the specific tool method and the
// authenticated user, so a token can't be replayed against a different user
// or spliced onto a call to a different tool.
export const confirmationCodec = createRequestStateCodec<ConfirmationState>({
  key,
  bind: (ctx: ServerContext) => {
    const ownerUserId = ctx.http?.authInfo?.extra?.ownerUserId;
    return `${ctx.mcpReq.method}\0${typeof ownerUserId === 'string' ? ownerUserId : ''}`;
  },
});

/**
 * True when this request's client can answer an embedded elicitation.
 *
 * Confirmation rides multi-round-trip elicitation, which only exists on the
 * 2026-07-28 revision: the request carries the client's capabilities in its
 * `_meta` envelope. A 2025-era request has no envelope and no live connection
 * to send `elicitation/create` over (this server is served statelessly), so
 * ChatGPT connectors, the legacy Muse CLI and any client that does not declare
 * the capability cannot answer one — they take the confirm-token path instead.
 */
export function clientCanElicit(ctx: ServerContext): boolean {
  const envelope: unknown = ctx.mcpReq.envelope;
  if (!isObject(envelope)) return false;
  const capabilities = envelope[CLIENT_CAPABILITIES_META_KEY];
  return isObject(capabilities) && 'elicitation' in capabilities;
}
