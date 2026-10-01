-- +goose Up
-- +goose StatementBegin

-- Refuse to proceed if the data already holds a loop; adding the guard on top of one would hide it.
DO $$
DECLARE
  looped uuid[];
BEGIN
  WITH RECURSIVE walk(start_id, id) AS (
    SELECT c.id, c.parent_container_id FROM app.possession_containers c
    WHERE c.parent_container_id IS NOT NULL
    UNION
    SELECT w.start_id, c.parent_container_id FROM walk w
    JOIN app.possession_containers c ON c.id = w.id
    WHERE c.parent_container_id IS NOT NULL
  )
  SELECT array_agg(DISTINCT start_id) INTO looped FROM walk WHERE id = start_id;
  IF looped IS NOT NULL THEN
    RAISE EXCEPTION 'possession_containers already contain cycles: %', looped;
  END IF;
END $$;

ALTER TABLE app.possession_containers
  DROP CONSTRAINT IF EXISTS possession_containers_not_own_parent;
ALTER TABLE app.possession_containers
  ADD CONSTRAINT possession_containers_not_own_parent
  CHECK (parent_container_id IS NULL OR parent_container_id <> id);

-- A container may not sit inside itself or any of its own descendants: walk up from the proposed
-- parent and reject if the walk reaches the row being written. The per-owner advisory lock makes
-- hierarchy changes queue up, so two concurrent moves (A under B, B under A) cannot both pass the
-- check against each other's uncommitted state. It is released when the transaction ends.
CREATE OR REPLACE FUNCTION app.reject_possession_container_cycle() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('possession-containers:' || NEW.owner_userId::text, 0));
  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_container_id FROM app.possession_containers
      WHERE id = NEW.parent_container_id AND owner_userId = NEW.owner_userId
      UNION
      SELECT c.id, c.parent_container_id FROM app.possession_containers c
      JOIN ancestors a ON c.id = a.parent_container_id
      WHERE c.owner_userId = NEW.owner_userId
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'A container cannot be nested inside itself or its own contents'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'possession_containers_no_cycle';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_possession_containers_no_cycle ON app.possession_containers;
CREATE TRIGGER trg_possession_containers_no_cycle
  BEFORE INSERT OR UPDATE OF parent_container_id ON app.possession_containers
  FOR EACH ROW WHEN (NEW.parent_container_id IS NOT NULL)
  EXECUTE FUNCTION app.reject_possession_container_cycle();

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TRIGGER IF EXISTS trg_possession_containers_no_cycle ON app.possession_containers;
DROP FUNCTION IF EXISTS app.reject_possession_container_cycle();
ALTER TABLE app.possession_containers
  DROP CONSTRAINT IF EXISTS possession_containers_not_own_parent;

-- +goose StatementEnd
