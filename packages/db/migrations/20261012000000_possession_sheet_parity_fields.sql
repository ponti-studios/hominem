-- +goose Up
-- +goose StatementBegin

-- Sheet-parity fields for the possessions migration (plan §5): first-class weight, volume,
-- vessel token, lifecycle enums, and vessel/tracking config on containers.

ALTER TABLE app.possessions
  ADD COLUMN IF NOT EXISTS weight_kg numeric(8,3),
  ADD COLUMN IF NOT EXISTS volume_cbm numeric(8,3),
  ADD COLUMN IF NOT EXISTS move_action text,
  ADD COLUMN IF NOT EXISTS acquisition_type text,
  ADD COLUMN IF NOT EXISTS purchase_currency text,
  ADD COLUMN IF NOT EXISTS retirement_method text,
  ADD COLUMN IF NOT EXISTS ownership_type text;

ALTER TABLE app.possessions DROP CONSTRAINT IF EXISTS possessions_status_check;
ALTER TABLE app.possessions ADD CONSTRAINT possessions_status_check CHECK (
  status IS NULL OR status IN
    ('wishlist', 'planned', 'ordered', 'delivered', 'owned', 'in_use', 'retired', 'disposed',
     'donated', 'sold')
);

ALTER TABLE app.possession_containers
  ADD COLUMN IF NOT EXISTS tracking_reference text,
  ADD COLUMN IF NOT EXISTS limit_kg numeric(8,3),
  ADD COLUMN IF NOT EXISTS tare_kg numeric(8,3);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE app.possession_containers
  DROP COLUMN IF EXISTS tare_kg,
  DROP COLUMN IF EXISTS limit_kg,
  DROP COLUMN IF EXISTS tracking_reference;

ALTER TABLE app.possessions DROP CONSTRAINT IF EXISTS possessions_status_check;
UPDATE app.possessions SET status = 'disposed' WHERE status IN ('donated', 'sold');
ALTER TABLE app.possessions ADD CONSTRAINT possessions_status_check CHECK (
  status IS NULL OR status IN
    ('wishlist', 'planned', 'ordered', 'delivered', 'owned', 'in_use', 'retired', 'disposed')
);
ALTER TABLE app.possessions
  DROP COLUMN IF EXISTS ownership_type,
  DROP COLUMN IF EXISTS retirement_method,
  DROP COLUMN IF EXISTS purchase_currency,
  DROP COLUMN IF EXISTS acquisition_type,
  DROP COLUMN IF EXISTS move_action,
  DROP COLUMN IF EXISTS volume_cbm,
  DROP COLUMN IF EXISTS weight_kg;

-- +goose StatementEnd
