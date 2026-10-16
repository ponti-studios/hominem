-- +goose Up
DROP TRIGGER IF EXISTS app_travel_residences_set_updated_at ON app.travel_residences;
CREATE TRIGGER app_travel_residences_set_updated_at
  BEFORE UPDATE ON app.travel_residences
  FOR EACH ROW EXECUTE FUNCTION app.set_travel_updated_at();

-- +goose Down
DROP TRIGGER IF EXISTS app_travel_residences_set_updated_at ON app.travel_residences;
CREATE TRIGGER app_travel_residences_set_updated_at
  BEFORE UPDATE ON app.travel_residences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
