# Starling

Hominem connector for Starling read-only account, transaction, and balance data.

## Usage

```text
hominem starling accounts
hominem starling balances
hominem starling transactions [--days N] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

The connector delegates to the existing wealth Starling client, so account routing,
Spaces, audit events, and transaction normalization stay identical across CLI and
routine surfaces.

## Configuration

- `STARLING_API_TOKEN` is required.
- `STARLING_API_BASE` is optional and defaults to `https://api.starlingbank.com`.
