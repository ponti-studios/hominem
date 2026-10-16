-- +goose Up
-- +goose StatementBegin

-- Managed possessions categories (cross-platform merge, decision 8). Still and
-- Possessions both carry a free-text category; the canonical set of category
-- records lives here, unique per owner case-insensitively, so the two apps
-- converge on one list. `possessions.possession_type` stays as the free-text
-- fallback and for legacy rows.
CREATE TABLE IF NOT EXISTS app.possession_categories (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  owner_userId text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  createdAt timestamptz NOT NULL DEFAULT now(),
  updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_possession_categories_owner_name_key
  ON app.possession_categories (owner_userId, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS idx_app_possession_categories_owner
  ON app.possession_categories(owner_userId);
CREATE TRIGGER app_possession_categories_set_updated_at
  BEFORE UPDATE ON app.possession_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE app.possession_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.possession_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY app_possession_categories_owner_policy ON app.possession_categories
  FOR ALL
  USING (auth.is_service_role() OR owner_userId = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR owner_userId = auth.current_user_id());

-- One managed record per case-insensitive category, keeping the most common
-- casing as the display name (ties break on the name itself, so it is stable).
WITH casings AS (
  SELECT owner_userId AS owner, btrim(possession_type) AS name, count(*) AS uses
  FROM app.possessions
  WHERE possession_type IS NOT NULL AND btrim(possession_type) <> ''
  GROUP BY owner_userId, btrim(possession_type)
),
picked AS (
  SELECT DISTINCT ON (owner, lower(name)) owner, name
  FROM casings
  ORDER BY owner, lower(name), uses DESC, name
)
INSERT INTO app.possession_categories (owner_userId, name)
SELECT owner, name FROM picked
ON CONFLICT DO NOTHING;

-- Collapse case variants onto the managed record's display name, so the two
-- apps render one spelling.
UPDATE app.possessions p
SET possession_type = c.name
FROM app.possession_categories c
WHERE c.owner_userId = p.owner_userId
  AND lower(c.name) = lower(btrim(p.possession_type))
  AND p.possession_type <> c.name;

-- Archived visibility: the end states read as archived. The status value itself
-- is kept, so the reason (retired/disposed/donated/sold) is never lost; the
-- status-to-lifecycle table is docs/status-category-mapping.md.
UPDATE app.possessions
SET is_archived = true
WHERE status IN ('retired', 'disposed', 'donated', 'sold')
  AND is_archived = false;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- The case-collapse and the archived backfill are not reversed: there is no way
-- to tell a normalized row from one the owner typed that way. Dropping the
-- managed records is safe because the free-text `possession_type` remains.
DROP TABLE IF EXISTS app.possession_categories;

-- +goose StatementEnd
