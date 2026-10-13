-- +goose Up
-- +goose StatementBegin

-- A packing vessel's member tokens (plan §6.5): the moveAction values and packed-container
-- names whose items roll up into this vessel in the weight report. The weights tab's
-- formulas are the authority for these; they mix free tokens (luggage_medium) with
-- packed-container names (vacuum_pants), so a text[] is the uniform home. Empty/NULL means
-- the container is not a packing vessel.
ALTER TABLE app.possession_containers
  ADD COLUMN IF NOT EXISTS vessel_tokens text[];

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.possession_containers DROP COLUMN IF EXISTS vessel_tokens;

-- +goose StatementEnd
