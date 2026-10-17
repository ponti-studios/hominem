-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.log_place_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb; operation_name text;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  operation_name := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  INSERT INTO app.place_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (
    coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'), TG_TABLE_NAME,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid), operation_name, changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.log_place_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  INSERT INTO app.place_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (
    coalesce(after_row ->> 'owner_userid', before_row ->> 'owner_userid'), TG_TABLE_NAME,
    coalesce((after_row ->> 'id')::uuid, (before_row ->> 'id')::uuid), lower(TG_OP), changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- +goose StatementEnd
