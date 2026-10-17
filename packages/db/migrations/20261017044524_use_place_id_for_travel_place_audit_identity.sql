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
    position(',' || coalesce(before_row ->> 'owner_userid', before_row ->> 'owner_userId') || ',' IN ',' || deleting_owner || ',') > 0 OR
    NOT EXISTS (
      SELECT 1 FROM public."user"
      WHERE id = coalesce(before_row ->> 'owner_userid', before_row ->> 'owner_userId')
    )
  ) THEN
    RETURN OLD;
  END IF;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  audit_operation := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  INSERT INTO app.travel_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (
    coalesce(after_row ->> 'owner_userid', after_row ->> 'owner_userId', before_row ->> 'owner_userid', before_row ->> 'owner_userId'),
    TG_TABLE_NAME,
    coalesce(after_row ->> 'id', after_row ->> 'place_id', before_row ->> 'id', before_row ->> 'place_id')::uuid,
    audit_operation, changed, CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.log_travel_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb; audit_operation text; deleting_owner text;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  deleting_owner := coalesce(current_setting('app.travel_owner_deleting', true), '');
  IF TG_OP = 'DELETE' AND (
    position(',' || coalesce(before_row ->> 'owner_userid', before_row ->> 'owner_userId') || ',' IN ',' || deleting_owner || ',') > 0 OR
    NOT EXISTS (
      SELECT 1 FROM public."user"
      WHERE id = coalesce(before_row ->> 'owner_userid', before_row ->> 'owner_userId')
    )
  ) THEN
    RETURN OLD;
  END IF;
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO changed
  FROM jsonb_each(after_row) WHERE before_row -> key IS DISTINCT FROM value;
  audit_operation := CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END;
  INSERT INTO app.travel_entity_history(owner_userid, entity_table, entity_id, operation, changed_fields, snapshot)
  VALUES (coalesce(after_row ->> 'owner_userid', after_row ->> 'owner_userId', before_row ->> 'owner_userid', before_row ->> 'owner_userId'),
    TG_TABLE_NAME, coalesce(after_row ->> 'id', before_row ->> 'id')::uuid, audit_operation, changed,
    CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- +goose StatementEnd
