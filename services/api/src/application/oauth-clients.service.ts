import { authDb, sql } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';

// The OAuth clients (Claude, ChatGPT, Cursor, ...) a person has let into their
// account through the MCP consent flow. Raw SQL on `authDb`: the Better Auth
// OAuth tables are not in the Kysely types, and `authDb` keeps column names as-is.
//
// Access tokens are self-contained JWTs with no row behind them, so revoking
// cuts off everything that can mint or renew one (consent + refresh tokens);
// an access token already handed out simply runs out its (short) lifetime.

export type OAuthClientRow = {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  scopes: string[];
  authorizedAt: string;
};

type ClientQueryRow = {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  scopes: string | null;
  authorizedAt: Date | string;
};

export async function listOAuthClients(input: { userId: string }): Promise<OAuthClientRow[]> {
  const { rows } = await sql<ClientQueryRow>`
    with granted as (
      select "clientId" from "oauthConsent" where "userId" = ${input.userId}
      union
      select "clientId" from "oauthRefreshToken"
        where "userId" = ${input.userId} and revoked is null and "expiresAt" > now()
    )
    select
      c."clientId", c.name, c.uri, c.icon,
      coalesce(
        (select k.scopes from "oauthConsent" k
          where k."clientId" = c."clientId" and k."userId" = ${input.userId}
          order by k."updatedAt" desc limit 1),
        (select r.scopes from "oauthRefreshToken" r
          where r."clientId" = c."clientId" and r."userId" = ${input.userId}
          order by r."createdAt" desc limit 1)
      ) as scopes,
      least(
        (select min(k."createdAt") from "oauthConsent" k
          where k."clientId" = c."clientId" and k."userId" = ${input.userId}),
        (select min(r."createdAt") from "oauthRefreshToken" r
          where r."clientId" = c."clientId" and r."userId" = ${input.userId})
      ) as "authorizedAt"
    from "oauthClient" c
    join granted g on g."clientId" = c."clientId"
    order by "authorizedAt" desc
  `.execute(authDb);

  return rows.map((row) => ({
    clientId: row.clientId,
    name: row.name,
    uri: row.uri,
    icon: row.icon,
    scopes: row.scopes?.split(' ').filter(Boolean) ?? [],
    authorizedAt: new Date(row.authorizedAt).toISOString(),
  }));
}

/** Pulls one client's access out of the account: forget the consent, kill refresh/access tokens. */
export async function revokeOAuthClient(input: {
  userId: string;
  clientId: string;
}): Promise<{ revoked: boolean }> {
  const touched = await authDb.transaction().execute(async (trx) => {
    const consent = await sql`
      delete from "oauthConsent"
      where "userId" = ${input.userId} and "clientId" = ${input.clientId}`.execute(trx);
    const refresh = await sql`
      update "oauthRefreshToken" set revoked = now()
      where "userId" = ${input.userId} and "clientId" = ${input.clientId} and revoked is null`.execute(
      trx,
    );
    const access = await sql`
      update "oauthAccessToken" set revoked = now()
      where "userId" = ${input.userId} and "clientId" = ${input.clientId} and revoked is null`.execute(
      trx,
    );
    return (
      Number(consent.numAffectedRows ?? 0) +
      Number(refresh.numAffectedRows ?? 0) +
      Number(access.numAffectedRows ?? 0)
    );
  });

  if (touched === 0) throw new NotFoundError('OAuth client not found');
  return { revoked: true };
}
