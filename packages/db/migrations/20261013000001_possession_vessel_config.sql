-- +goose Up
-- +goose StatementBegin

-- Per-owner vessel configuration for the weight report (plan §6.5). The weights tab's
-- formulas are the source, but the values are the owner's, so they live here rather than
-- in code:
--   marker_tokens      moveAction values that name no vessel and no container — travel or
--                      disposal annotations (e.g. carry, kelsey, dispose, sell). The report
--                      counts these separately instead of treating them as unknown vessels.
--   group_allowances   shared airline allowance (kg) per packing group, e.g. {"cabin": 12,
--                      "checked": 46} — a group limit is an allowance, not the sum of the
--                      member vessels' own limits.
CREATE TABLE IF NOT EXISTS app.possession_vessel_config (
  owner_userId text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  marker_tokens text[] NOT NULL DEFAULT '{}',
  group_allowances jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.possession_vessel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.possession_vessel_config FORCE ROW LEVEL SECURITY;
CREATE POLICY app_possession_vessel_config_owner_policy ON app.possession_vessel_config
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.possession_vessel_config;

-- +goose StatementEnd
