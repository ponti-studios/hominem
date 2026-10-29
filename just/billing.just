grant email by_email:
    pnpm --filter @hominem/api membership grant --email {{ quote(email) }} --by {{ quote(by_email) }}

revoke email by_email:
    pnpm --filter @hominem/api membership revoke --email {{ quote(email) }} --by {{ quote(by_email) }}
