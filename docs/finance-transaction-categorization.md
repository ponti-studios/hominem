# Finance transaction categorization

Transactions are managed in the Finance ledger. People can select visible rows or explicitly select
all matching results, then apply a category, tags, merchant or note edits, account changes, exclusion,
restoration, transfer linking, or deletion. Category changes update the selected transactions
immediately and create or replace a merchant rule in the user's live rulebook in the same database
transaction.

Merchant rules provide suggestions for future matching transactions. They do not categorize new
transactions automatically. The ledger distinguishes saved categories from suggestions, and leaves
transactions without either value marked Uncategorized. Existing queued rulings remain visible and
filterable in the ledger; their queue history is preserved.

The shared `FinanceTransaction` row is one line: selection, merchant, category state, and amount.
Date, account, notes, and other editable details appear in the transaction drawer. Split transactions
are not supported by this design.
