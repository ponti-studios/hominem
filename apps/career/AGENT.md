# AGENT.md - Hominem Career

## Commands

- `pnpm --filter @hominem/career dev` - Start development server
- `pnpm --filter @hominem/career build` - Build for production
- `pnpm --filter @hominem/career typecheck` - Run React Router typegen and TypeScript checking
- `pnpm --filter @hominem/career test` - Run Vitest
- `pnpm --filter @hominem/career lint` - Run oxlint
- `pnpm --filter @hominem/career format` - Run oxfmt

## Notes

- This app is intentionally self-contained for the first migration pass.
- Use shared workspace services for database, auth, and storage integrations.
- Use `~/*` imports for app-local modules.
