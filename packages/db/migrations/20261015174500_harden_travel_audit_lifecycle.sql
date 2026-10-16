-- +goose Up
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION app.log_travel_entity_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = app, auth, public AS $$
DECLARE before_row jsonb; after_row jsonb; changed jsonb; audit_operation text; deleting_owner text;
BEGIN
  before_row := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  after_row := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  deleting_owner := nullif(current_setting('app.travel_owner_deleting', true), '');
  IF TG_OP = 'DELETE' AND deleting_owner = before_row ->> 'owner_userid' THEN RETURN OLD; END IF;
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

CREATE OR REPLACE FUNCTION app.set_travel_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['travel_journeys','travel_journey_segments','travel_places','travel_transport','travel_stays','travel_airports','travel_ideas'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON app.%I', 'app_'||table_name||'_set_updated_at', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.set_travel_updated_at()', 'app_'||table_name||'_set_updated_at', table_name);
  END LOOP;
END $$;

CREATE FUNCTION app.mark_travel_owner_deletion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.travel_owner_deleting', OLD.id, true);
  RETURN OLD;
END $$;
CREATE TRIGGER app_user_mark_travel_owner_deletion
  BEFORE DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION app.mark_travel_owner_deletion();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS app_user_mark_travel_owner_deletion ON "user";
DROP FUNCTION IF EXISTS app.mark_travel_owner_deletion();
DROP FUNCTION IF EXISTS app.set_travel_updated_at();
-- +goose StatementEnd
