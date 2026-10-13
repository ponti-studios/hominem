-- +goose Up
-- +goose StatementBegin

-- Packing group for the vessel weight report (plan §6.5 rollups): which airline allowance a
-- vessel counts against. Free string, not an enum — the groups are cabin/checked today and the
-- report sums whatever groups exist. NULL means the container is not a packing vessel.
ALTER TABLE app.possession_containers
  ADD COLUMN IF NOT EXISTS vessel_group text;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.possession_containers DROP COLUMN IF EXISTS vessel_group;

-- +goose StatementEnd
