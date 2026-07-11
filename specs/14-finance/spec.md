# Feature Specification: Finance

**Feature Branch**: `14-finance`

**Created**: 2026-07-10

**Status**: Draft

**Input**: Extend the personal financial activity served by `apps/finance` with trustworthy, bounded read models for summaries, retaining source and accounting context.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Institutions, Accounts, and Transactions (Priority: P1)

As a user, I want to record financial institutions with their accounts and transactions so that I can track all financial activity in one place.

**Why this priority**: Institutions, accounts, and transactions are the core financial hierarchy — everything else depends on them.

**Independent Test**: An institution with one account containing multiple transactions can be created; querying returns the full hierarchy with correct amounts.

**Acceptance Scenarios**:

1. **Given** an institution with a checking account containing five transactions, **When** queried, **Then** the institution, account, and all five transactions are returned with correct amounts.
2. **Given** a transaction with `pending: true`, **When** queried, **Then** it is returned with its pending status distinct from posted transactions.

### User Story 2 - Transaction Postings with Categories (Priority: P1)

As a user, I want transactions to have postings that classify money movement by account and category so that I can understand how money flows between accounts and what categories spending falls under.

**Why this priority**: Postings and categories provide the analytic dimension that makes financial data useful.

**Independent Test**: A transaction with two postings (one for the source account, one for the category) can be created; querying returns the categorized postings.

**Acceptance Scenarios**:

1. **Given** a transaction with postings that each carry an `amount`, `account_id`, and `category_id`, **When** queried, **Then** each posting is returned with its classification.
2. **Given** a transaction with zero postings, **When** queried, **Then** the transaction still exists but postings are empty — the system tolerates optional postings.

### User Story 3 - Statement Periods as Immutable Documents (Priority: P2)

As a user, I want periodic statement periods with opening and closing balances so that I can reconcile account activity against immutable statements.

**Why this priority**: Statement periods provide audit-quality reconciliation.

**Independent Test**: A statement period with opening and closing balances can be created for an account; querying returns the statement with its balance observations.

**Acceptance Scenarios**:

1. **Given** a statement period with `opening_balance` and `closing_balance`, **When** queried, **Then** both balance values are returned as immutable observations.
2. **Given** transactions fall within a statement period's date range, **When** the statement is queried, **Then** those transactions are associated with the statement.

### User Story 4 - Private MCP Finance Summary (Priority: P2)

As an AI assistant with `finance:read` scope, I want to query a capped monthly summary so that I can answer finance questions without unrestricted transaction search.

**Why this priority**: Finance is highly sensitive — MCP access must be bounded and explicit.

**Independent Test**: An MCP query with explicit finance scope returns a capped monthly summary (date/amount/merchant/category context) — no unrestricted search.

**Acceptance Scenarios**:

1. **Given** an MCP tool with `finance:read` scope, **When** a monthly summary is requested, **Then** bounded context (dates, amounts, merchants, categories) is returned — no unrestricted transaction list.
2. **Given** a query that exceeds the result cap, **When** invoked, **Then** the response is truncated to the cap and no-data is reported for the remainder.

### Edge Cases

- What happens when a top-level `finance_transactions.amount` and the sum of its postings disagree?
- How does the system handle transactions in multiple currencies?
- What happens when a Plaid sync fails — does the error state propagate to the account?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `app.finance_institutions` MUST provide `app.finance_accounts`.
- **FR-002**: Amounts MUST be decimal (`numeric(14,2)`) plus ISO currency — no floating-point money.
- **FR-003**: `app.finance_transactions` MUST carry `pending` status to distinguish pending from posted.
- **FR-004**: Transactions MUST carry `app.finance_transaction_postings` that classify money movement by account and category.
- **FR-005**: `app.finance_statement_periods` MUST be immutable documents with opening and closing balances.
- **FR-006**: Balances MUST be observations, not assumed ledger truth.
- **FR-007**: Finance data MUST be classified as highly sensitive — default AI evidence is bounded date/amount/merchant/category context.
- **FR-008**: Account identifiers, statement files, provider payloads, and raw descriptions MUST require an explicit future grant.
- **FR-009**: MCP finance summary MUST require explicit finance scope and return capped summaries with minimal evidence.
- **FR-010**: Tests MUST cover monthly money math, merchant grouping, caps, bounded transaction evidence, no unrestricted search, and sensitive-field redaction.

### Key Entities

- **app.finance_institutions**: Financial institutions with optional Plaid sync.
- **app.finance_accounts**: Accounts within an institution.
- **app.finance_transactions**: Individual transactions with amount, pending status, and optional postings.
- **app.finance_transaction_postings**: Money movement classification by account and category.
- **app.finance_categories**: Spending and income categories.
- **app.finance_merchants**: Normalized merchant identity.
- **app.finance_statement_periods**: Immutable statement documents with opening/closing balances.
- **app.plaid_items**: Plaid connection state (sync cursor, error state) per institution link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Finance repositories expose institutions, accounts, transactions, postings, categories, merchants, and statement reads.
- **SC-002**: Services use integer/decimal money semantics and never float arithmetic.
- **SC-003**: RPC finance summary endpoint uses sensitive-field DTO boundaries.
- **SC-004**: MCP finance summary requires explicit finance scope and returns capped summaries with minimal evidence.
- **SC-005**: Tests cover monthly money math, merchant grouping, caps, bounded transaction evidence, no unrestricted search, and sensitive-field redaction.
- **SC-006**: Repository and service coverage includes postings, categories, statements, and account status.

## Assumptions

- `finance_transactions.amount` carries a signed amount directly on the transaction in addition to posting amounts — this is known duplication and the two can in principle disagree.
- Postings are optional — a transaction can exist with zero postings.
- `finance_transactions.provider_payload jsonb` stores provider data directly on the canonical row — tolerated as implementation detail.
- `app.budgets` and `app.account_balances` (as separate observation tables) are not implemented — balance is read from `finance_accounts.current_balance`/`available_balance` directly.
- Investment holdings, balance-observation history, and budgets remain deferred.
- Finance is the final planned domain and remains disabled for external clients until consent, revocation, audit logging, scope-denial tests, and security review are complete.
- `app.portfolios` in Plan 01 is an unrelated public career-profile table, not an investment portfolio — the name collision is coincidental.
