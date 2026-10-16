-- +goose Up
-- +goose StatementBegin
ALTER TABLE app.travel_stays
  ALTER COLUMN segment_id DROP NOT NULL,
  ALTER COLUMN journey_id DROP NOT NULL;

ALTER TABLE app.travel_stays
  ADD CONSTRAINT travel_stays_link_consistency CHECK (
    (evidence = 'want' AND (
      (segment_id IS NULL AND journey_id IS NULL)
      OR (segment_id IS NOT NULL AND journey_id IS NOT NULL)
    ))
    OR (evidence <> 'want' AND segment_id IS NOT NULL AND journey_id IS NOT NULL)
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE app.travel_stays DROP CONSTRAINT travel_stays_link_consistency;
ALTER TABLE app.travel_stays
  ALTER COLUMN segment_id SET NOT NULL,
  ALTER COLUMN journey_id SET NOT NULL;
-- +goose StatementEnd
