-- +goose Up
-- +goose StatementBegin
-- Email domains (lower case, no @) whose people may receive a provider credential.
-- Sign-in proves the person owns the address, so a domain rule is as safe as listing
-- each address. Gates only minting a key; blocks still win.
CREATE TABLE app.credential_allowed_domains (
  domain text PRIMARY KEY CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.credential_allowed_domains;
-- +goose StatementEnd
