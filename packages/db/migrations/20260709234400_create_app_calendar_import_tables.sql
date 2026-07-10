-- +goose Up
-- +goose StatementBegin

CREATE TABLE app.calendar_event_sources (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  source_id uuid NOT NULL REFERENCES app.import_sources(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  calendar_uid text NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.event_occurrences (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  event_id uuid NOT NULL REFERENCES app.events(id) ON DELETE CASCADE,
  occurrence_key text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  occurrence_date date,
  is_all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS app.event_occurrences;
DROP TABLE IF EXISTS app.calendar_event_sources;

-- +goose StatementEnd
