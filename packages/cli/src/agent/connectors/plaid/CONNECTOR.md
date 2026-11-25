# Plaid

Native Plaid REST connector for Hominem finance ingestion.

## Commands

```text
hominem plaid status
hominem plaid auth
hominem plaid accounts
hominem plaid transactions --since YYYY-MM-DD --until YYYY-MM-DD
hominem plaid liabilities [--credential-id ID]
```

## Configuration

- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` (`sandbox` or `production`)
- `PLAID_ACCESS_TOKEN` (written by `hominem plaid auth`)
- `PLAID_ITEM_ID` (written by `hominem plaid auth`)

Secrets live in `~/.hominem/env`, mode `600`. Plaid is ingest-only:
transactions feed Hominem, and Hominem remains the source of financial
analysis.
