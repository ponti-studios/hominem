import { createHmac } from 'node:crypto';

import { createRequestStateCodec, type ServerContext } from '@modelcontextprotocol/server';

import { env } from '../env';

export interface ConfirmationState {
  tool: string;
  args: unknown;
}

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
