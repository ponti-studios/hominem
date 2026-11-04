-- +goose Up
-- +goose StatementBegin
-- A Bill is reference data about a recurring obligation — who it is with, how it is paid, what it
-- should cost — plus the derivation rules that hang off it. It is never a payment mechanism:
-- Hominem syncs nothing and a bill never creates, moves or edits a transaction.
-- One table carries the detection lifecycle (type: suggested -> confirmed, cancelled terminal)
-- so detection materialises the same row a user later confirms; there is no separate dismissals
-- table, dismissal state lives on the suggested row itself.
CREATE TABLE app.finance_bills (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  provider_name text CHECK (provider_name IS NULL OR length(btrim(provider_name)) > 0),
  kind text NOT NULL CHECK (
    kind IN ('electricity', 'heating', 'water', 'broadband', 'council_tax', 'insurance', 'rent', 'other')
  ),
  -- Stored and returned verbatim: account numbers, customer references, meter serials.
  account_number text,
  payment_method text NOT NULL CHECK (
    payment_method IN ('direct_debit', 'pay_as_you_go', 'card', 'manual', 'other')
  ),
  amount_model text NOT NULL CHECK (amount_model IN ('fixed', 'variable', 'top_up')),
  -- NULL for a variable bill. For a top_up bill this is the typical top-up amount.
  expected_amount_cents integer CHECK (expected_amount_cents IS NULL OR expected_amount_cents >= 0),
  currency_code text NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
  -- No recurrence for a top_up bill (cadence is effectively manual) or for a bill whose cadence
  -- has not been filled in yet; a one_off bill carries due_date instead.
  cadence text CHECK (
    cadence IS NULL OR cadence IN ('weekly', 'monthly', 'quarterly', 'annual', 'one_off')
  ),
  -- 1-31. A short month clamps the computed due date to its last day; never stored as a date.
  due_day integer CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  due_date date,
  -- Reference point weekly/quarterly/annual cadences step from. Monthly needs no anchor.
  anchor_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  type text NOT NULL DEFAULT 'confirmed' CHECK (type IN ('suggested', 'confirmed', 'cancelled')),
  is_dismissed boolean NOT NULL DEFAULT false,
  last_dismissed_at timestamptz,
  -- Every string that identifies this supplier in a feed; a transaction matches when any one of
  -- them is a case-insensitive substring of its merchant name or description.
  merchant_match text[] NOT NULL DEFAULT '{}',
  -- top_up only: hours after the latest balance entry at which the balance is flagged stale.
  stale_after_hours integer NOT NULL DEFAULT 48 CHECK (stale_after_hours > 0),
  -- top_up only: low-balance warning threshold in days of credit remaining, not money.
  payg_warn_days integer NOT NULL DEFAULT 7 CHECK (payg_warn_days > 0),
  notes text,
  account_id uuid REFERENCES app.finance_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A recurrence needs a cadence, and a cadence needs something to be due on (or an anchor for
  -- the cadences that step from one). Enforced here so no writer can store a half-schedule.
  CONSTRAINT finance_bills_schedule_check CHECK (
    cadence IS NULL
    OR (cadence = 'one_off' AND due_date IS NOT NULL)
    OR (cadence = 'monthly' AND due_day IS NOT NULL)
    OR (cadence IN ('weekly', 'quarterly', 'annual') AND due_day IS NOT NULL)
  )
);

CREATE INDEX idx_finance_bills_user ON app.finance_bills(user_id);
CREATE INDEX idx_finance_bills_user_created ON app.finance_bills(user_id, created_at);
-- Earliest-created bill claims a matched transaction, so the claim query orders by created_at.
CREATE INDEX idx_finance_bills_merchant_match ON app.finance_bills USING gin(merchant_match);

CREATE TRIGGER set_updated_at_finance_bills
  BEFORE UPDATE ON app.finance_bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake();

ALTER TABLE app.finance_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_bills FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_bills_owner_policy ON app.finance_bills
  FOR ALL
  USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());

-- Append-only observations of a top_up bill's supplier balance: one row per check, corrections
-- are new rows. Hominem syncs nothing; an agent reads the supplier portal and writes what it saw,
-- so an observation is only ever "balance X as of checked_at". created_at is the write time and is
-- deliberately separate from checked_at, which the writer supplies.
-- No currency column: the bill owns its currency, and repeating it per row would be a second
-- source of truth that can only disagree with the first.
CREATE TABLE app.finance_bill_balance_entries (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES app.finance_bills(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Signed: a disconnected supply can sit at a negative balance (-1053 = -£10.53).
  balance_cents integer NOT NULL,
  -- A reading is a measurement, not money (e.g. 2436.14 kWh).
  meter_reading_kwh numeric(14,3),
  supply_status text NOT NULL CHECK (supply_status IN ('connected', 'disconnected', 'unknown')),
  source text NOT NULL CHECK (source IN ('agent_portal', 'user_report', 'meter_photo')),
  note text
);

-- Main read pattern: a bill's log, most recent first. Deliberately NOT unique on
-- (bill_id, checked_at): two agents may log the same moment, and the log records observations.
CREATE INDEX idx_finance_bill_balance_entries_bill_checked
  ON app.finance_bill_balance_entries(bill_id, checked_at DESC);

ALTER TABLE app.finance_bill_balance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.finance_bill_balance_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_bill_balance_entries_owner_policy ON app.finance_bill_balance_entries
  FOR ALL
  USING (auth.is_service_role() OR user_id = auth.current_user_id())
  WITH CHECK (auth.is_service_role() OR user_id = auth.current_user_id());
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app.finance_bill_balance_entries;
DROP TABLE IF EXISTS app.finance_bills;
-- +goose StatementEnd
