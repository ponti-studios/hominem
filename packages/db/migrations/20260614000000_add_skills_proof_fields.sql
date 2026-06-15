-- +goose Up
ALTER TABLE app.skills ADD COLUMN ai_derived boolean NOT NULL DEFAULT false;
ALTER TABLE app.skills ADD COLUMN proof text;

-- +goose Down
ALTER TABLE app.skills DROP COLUMN proof;
ALTER TABLE app.skills DROP COLUMN ai_derived;
