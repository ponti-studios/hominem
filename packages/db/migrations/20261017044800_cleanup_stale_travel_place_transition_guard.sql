-- +goose Up
-- +goose StatementBegin
DO $$
DECLARE guard_function regprocedure;
BEGIN
  guard_function := to_regprocedure('app.guard_travel_place_identity_transition()');
  IF guard_function IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgfoid = guard_function AND NOT tgisinternal
  ) THEN
    DROP FUNCTION app.guard_travel_place_identity_transition();
  END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
SELECT 1;
