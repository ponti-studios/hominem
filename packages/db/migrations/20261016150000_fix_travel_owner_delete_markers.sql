-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.log_travel_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb; audit_operation text; deleting_owner text;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  deleting_owner := coalesce(current_setting('app.travel_owner_deleting', true), '');
  IF TG_OP = 'DELETE' AND (
    position(',' || (before_row ->> 'owner_userid') || ',' IN ',' || deleting_owner || ',') > 0 OR
    NOT EXISTS (SELECT 1 FROM public."user" WHERE id = before_row ->> 'owner_userid')
  ) THEN RETURN OLD; END IF;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  audit_operation := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  INSERT INTO app.travel_entity_history(owner_userId, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'), TG_TABLE_NAME,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid), audit_operation, changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION app.mark_travel_owner_deletion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'app.travel_owner_deleting',
    concat_ws(',', nullif(current_setting('app.travel_owner_deleting', true), ''), OLD.id),
    true
  );
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION app.prevent_travel_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF position(',' || OLD.owner_userId || ',' IN ',' || current_setting('app.travel_owner_deleting', true) || ',') > 0
    OR NOT EXISTS (SELECT 1 FROM public."user" WHERE id = OLD.owner_userId) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'travel entity history is append-only' USING ERRCODE = '42501';
END $$;

CREATE OR REPLACE FUNCTION app.clear_travel_owner_deletion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.travel_owner_deleting', '', true);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS app_user_clear_travel_owner_deletion ON "user";
CREATE TRIGGER app_user_clear_travel_owner_deletion
  AFTER DELETE ON "user" FOR EACH STATEMENT EXECUTE FUNCTION app.clear_travel_owner_deletion();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS app_user_clear_travel_owner_deletion ON "user";
DROP FUNCTION IF EXISTS app.clear_travel_owner_deletion();
-- +goose StatementEnd
