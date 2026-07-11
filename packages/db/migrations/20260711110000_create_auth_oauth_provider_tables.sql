-- +goose Up
-- +goose StatementBegin

-- Better Auth OIDC provider schema (backs the `mcp()` plugin's dynamic
-- client registration + token issuance). Do NOT manually edit these
-- tables — they are owned by Better Auth.

CREATE TABLE "oauthApplication" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  metadata TEXT,
  "clientId" TEXT NOT NULL UNIQUE,
  "clientSecret" TEXT,
  "redirectUrls" TEXT NOT NULL,
  type TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT false,
  "userId" TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "oauthAccessToken" (
  id TEXT PRIMARY KEY,
  "accessToken" TEXT NOT NULL UNIQUE,
  "refreshToken" TEXT NOT NULL UNIQUE,
  "accessTokenExpiresAt" TIMESTAMPTZ NOT NULL,
  "refreshTokenExpiresAt" TIMESTAMPTZ NOT NULL,
  "clientId" TEXT NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  scopes TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "oauthConsent" (
  id TEXT PRIMARY KEY,
  "clientId" TEXT NOT NULL REFERENCES "oauthApplication"("clientId") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  scopes TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "consentGiven" BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX oauth_application_user_id_idx ON "oauthApplication" ("userId");
CREATE INDEX oauth_access_token_client_id_idx ON "oauthAccessToken" ("clientId");
CREATE INDEX oauth_access_token_user_id_idx ON "oauthAccessToken" ("userId");
CREATE INDEX oauth_consent_client_id_idx ON "oauthConsent" ("clientId");
CREATE INDEX oauth_consent_user_id_idx ON "oauthConsent" ("userId");

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS "oauthConsent";
DROP TABLE IF EXISTS "oauthAccessToken";
DROP TABLE IF EXISTS "oauthApplication";
-- +goose StatementEnd
