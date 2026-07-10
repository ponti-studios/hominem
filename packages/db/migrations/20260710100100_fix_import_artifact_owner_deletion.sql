-- +goose Up
-- +goose StatementBegin

-- An artifact is immutable during its owner's lifetime, but it must be removed
-- with that owner. CASCADE also lets a source-record cascade complete cleanly.
ALTER TABLE app.import_record_payloads
  DROP CONSTRAINT import_record_payloads_artifact_id_fkey,
  ADD CONSTRAINT import_record_payloads_artifact_id_fkey
    FOREIGN KEY (artifact_id) REFERENCES app.import_artifacts(id) ON DELETE CASCADE;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.import_record_payloads
  DROP CONSTRAINT import_record_payloads_artifact_id_fkey,
  ADD CONSTRAINT import_record_payloads_artifact_id_fkey
    FOREIGN KEY (artifact_id) REFERENCES app.import_artifacts(id) ON DELETE RESTRICT;

-- +goose StatementEnd
