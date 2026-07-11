# Plan 10: Purchases and possessions

## Outcome

Represent what was ordered, acquired, owned, maintained, and retired without conflating a transaction with a physical item.

## Implementation boundary

- **Schema:** [schema/10-purchases-possessions.sql](schema/10-purchases-possessions.sql)
- **Repository and service:** own purchases, possessions, warranties, and valuations as typed private records.
- **MCP:** no external purchasing or possession tool in v1; future read models must exclude account and document details.

## Canonical entities and relationships

`app.purchase_orders` contain `app.purchase_line_items`; a line item may reference a `possession_id` it produced. `app.possessions` represent individual owned items, optionally grouped into `app.possession_containers` (a physical storage location, e.g. "garage shelf"). `app.possession_events` is a single generic event log for a possession's lifecycle (valuation, warranty, loan, repair, ...) via `event_type`, rather than separate `item_warranties`/`item_valuations` tables.

## Lifecycle and invariants

An order can have multiple line items; a line item may reference at most one possession it produced (not "zero or many" — the relationship is one-to-zero-or-one at the schema level, though multiple line items across orders can each reference the same possession's replacement/repair events over time via `possession_events`). Possessions carry `purchase_date`/`purchase_price`/`current_value` directly rather than through a separate valuations table.

## Privacy and AI evidence

Purchases are sensitive when they reveal finances or location. AI evidence is bounded to product/possession label and lifecycle state; receipts remain private files.

## Rejected models

- One purchases table for orders, products, and possessions.
- Receipt OCR as canonical purchase truth.

## Divergence from the original design

There is no separate `app.products` catalog table — `purchase_line_items` carries its own `title` directly rather than referencing a reusable product description, so the same product bought twice creates two independent descriptions rather than one shared product row. `item_warranties` and `item_valuations` are unified into the single generic `possession_events` table (`event_type` distinguishes them) rather than kept as separate typed tables. `item_lists`/`item_list_entries` (intentional user collections) are **not implemented**.

## Delivery acceptance

- [ ] Purchase repositories expose orders, receipts/files, line items, possessions, and possession events.
- [ ] Services distinguish purchase facts, ownership lifecycle, warranties, repairs, and valuation events.
- [ ] API DTOs redact receipt/raw file details unless requested by an owner-scoped surface.
- [ ] MCP possession context returns bounded lifecycle evidence, not receipt dumps.
- [ ] Tests cover order totals, line-item linkage, possession status changes, warranty/valuation events, and receipt redaction.
- [ ] Deferred: reusable product catalog and intentional item lists.

## Deferred work

None.
