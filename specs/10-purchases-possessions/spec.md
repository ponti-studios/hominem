# Feature Specification: Purchases and Possessions

**Feature Branch**: `10-purchases-possessions`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Represent what was ordered, acquired, owned, maintained, and retired without conflating a transaction with a physical item.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Purchase Orders with Line Items (Priority: P1)

As a user, I want to record purchase orders with multiple line items so that I can track what I bought and how much I spent, without conflating the order with the physical items.

**Why this priority**: Orders and line items are the core purchase entities.

**Independent Test**: An order with multiple line items can be created; each line item has its own title, quantity, and price.

**Acceptance Scenarios**:

1. **Given** a purchase order with two line items, **When** queried, **Then** both line items are returned with their prices.
2. **Given** a line item that references a possession it produced, **When** queried, **Then** the possession is accessible from the line item.

### User Story 2 - Possessions with Lifecycle Events (Priority: P1)

As a user, I want to track individual possessions — their purchase details, warranty events, repairs, valuations, and loans — so that I can manage what I own over its lifecycle.

**Why this priority**: Possession lifecycle tracking is the core ownership feature.

**Independent Test**: A possession can be created with purchase date/price, and lifecycle events (valuation, warranty, loan, repair) can be added via `possession_events`.

**Acceptance Scenarios**:

1. **Given** a possession with `purchase_date`, `purchase_price`, and `current_value`, **When** queried, **Then** all three fields are returned.
2. **Given** a possession with a warranty event recorded in `possession_events`, **When** lifecycle events are queried, **Then** the warranty event appears with its `event_type`.

### User Story 3 - Possession Containers (Priority: P2)

As a user, I want to group possessions into physical storage locations (containers) so that I can organize where things are kept.

**Why this priority**: Containers provide organizational structure for possessions.

**Independent Test**: A container with multiple possessions can be created; querying the container returns all possessions within it.

**Acceptance Scenarios**:

1. **Given** a container (e.g., "Garage Shelf A"), **When** multiple possessions are assigned to it, **Then** querying the container returns all those possessions.
2. **Given** a possession reassigned to a different container, **When** queried, **Then** it appears in the new container only.

### Edge Cases

- What happens when a line item does not reference any possession?
- How does the system handle a possession that is sold or discarded — is it deleted or marked as retired?
- What happens when the same possession receives multiple valuation events?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.purchase_orders` MUST contain `app.purchase_line_items`.
- **FR-002**: A line item MUST reference at most one possession it produced (one-to-zero-or-one).
- **FR-003**: `app.possessions` MUST carry `purchase_date`, `purchase_price`, and `current_value` directly.
- **FR-004**: `app.possession_events` MUST be a single generic event log using `event_type` to distinguish valuations, warranties, loans, repairs, etc.
- **FR-005**: `app.possession_containers` MUST group possessions into physical storage locations.
- **FR-006**: API DTOs MUST redact receipt/raw file details unless requested by an owner-scoped surface.
- **FR-007**: Tests MUST cover order totals, line-item linkage, possession status changes, warranty/valuation events, and receipt redaction.

### Key Entities

- **app.purchase_orders**: Orders with multiple line items.
- **app.purchase_line_items**: Individual items in an order, optionally referencing a possession.
- **app.possessions**: Individual owned items with purchase date/price and current value.
- **app.possession_containers**: Physical storage locations grouping possessions.
- **app.possession_events**: Single generic event log for possession lifecycle (valuation, warranty, loan, repair) distinguished by `event_type`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Purchase repositories expose orders, line items, possessions, and possession events.
- **SC-002**: Services distinguish purchase facts, ownership lifecycle, warranties, repairs, and valuation events.
- **SC-003**: API DTOs redact receipt/raw file details unless requested by an owner-scoped surface.
- **SC-004**: MCP possession context returns bounded lifecycle evidence, not receipt dumps.
- **SC-005**: Tests cover order totals, line-item linkage, possession status changes, warranty/valuation events, and receipt redaction.

## Assumptions

- There is no separate `app.products` catalog table — `purchase_line_items` carries its own `title` directly rather than referencing a reusable product description.
- `item_warranties` and `item_valuations` are unified into the single generic `possession_events` table.
- `item_lists`/`item_list_entries` (intentional user collections) are not implemented.
- Purchases are sensitive when they reveal finances or location.
- AI evidence is bounded to product/possession label and lifecycle state, not receipt dumps.
- MCP possession tools are deferred for v1.
