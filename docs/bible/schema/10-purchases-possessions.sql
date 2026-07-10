-- Reconciled Up: no products catalog; warranties/valuations unified into possession_events; no item_lists.
CREATE TABLE app.purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, merchant_id uuid REFERENCES app.finance_merchants(id) ON DELETE SET NULL,
  ordered_at timestamptz, status text CHECK (status IS NULL OR status IN ('placed','fulfilled','cancelled','returned')),
  currency_code text NOT NULL DEFAULT 'USD', total_amount numeric(14,2), source text, external_id text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.possession_containers (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''), location text, description text,
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.possessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, container_id uuid REFERENCES app.possession_containers(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (btrim(name) <> ''), description text, purchase_date date,
  purchase_price numeric(12,2) CHECK (purchase_price IS NULL OR purchase_price >= 0), current_value numeric(12,2) CHECK (current_value IS NULL OR current_value >= 0),
  item_condition text, location text, serial_number text, metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app.purchase_line_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, purchase_order_id uuid NOT NULL REFERENCES app.purchase_orders(id) ON DELETE CASCADE,
  possession_id uuid REFERENCES app.possessions(id) ON DELETE SET NULL, title text NOT NULL CHECK (btrim(title) <> ''),
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0), unit_amount numeric(14,2), metadata jsonb NOT NULL DEFAULT '{}',
  createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now()
);
-- Unified lifecycle log: event_type distinguishes valuation/warranty/loan/repair/etc, replacing separate typed tables.
CREATE TABLE app.possession_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(), owner_userid text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, possessionId uuid NOT NULL REFERENCES app.possessions(id) ON DELETE CASCADE,
  container_id uuid REFERENCES app.possession_containers(id) ON DELETE SET NULL, event_type text NOT NULL CHECK (btrim(event_type) <> ''),
  occurred_at timestamptz, amount numeric(12,2) CHECK (amount IS NULL OR amount >= 0), amount_unit text, method text, start_date date, end_date date,
  metadata jsonb NOT NULL DEFAULT '{}', createdAt timestamptz NOT NULL DEFAULT now(), updatedAt timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
