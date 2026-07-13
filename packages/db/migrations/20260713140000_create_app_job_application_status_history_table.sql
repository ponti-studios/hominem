-- +goose Up
-- +goose StatementBegin
CREATE TABLE app.job_application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES app.job_applications(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  createdAt timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.job_application_status_history;
-- +goose StatementEnd
