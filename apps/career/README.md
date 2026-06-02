# Hominem Career

A self-contained React Router career tracking app migrated from CraftD into the Hominem workspace.

## Quick Start

```bash
pnpm install
cp apps/career/.env.example apps/career/.env
pnpm --filter @hominem/career db:up
pnpm --filter @hominem/career db:migrate
pnpm --filter @hominem/career dev
```

`db:migrate` now runs the shared monorepo migrations from `packages/core/db/migrations`.

The dev server runs on `http://localhost:4451`.

## Configuration

Required environment variables:

```dotenv
VITE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/craftd_dev
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/craftd_dev
VITE_PUBLIC_SUPABASE_URL=https://example.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Commands

| Need                    | Run                                      |
| ----------------------- | ---------------------------------------- |
| Start dev server        | `pnpm --filter @hominem/career dev`      |
| Build                   | `pnpm --filter @hominem/career build`    |
| Serve build             | `pnpm --filter @hominem/career start`    |
| Typecheck               | `pnpm --filter @hominem/career typecheck` |
| Lint                    | `pnpm --filter @hominem/career lint`     |
| Format                  | `pnpm --filter @hominem/career format`   |
| Test                    | `pnpm --filter @hominem/career test`     |
| Start local Postgres    | `pnpm --filter @hominem/career db:up`    |
| Stop local Postgres     | `pnpm --filter @hominem/career db:down`  |
| Run shared migrations   | `pnpm --filter @hominem/career db:migrate` |
| Inject job CSV data     | `pnpm --filter @hominem/career db:inject-jobs` |

## Notes

- Auth remains on Supabase for this migration.
- Database access now goes through `@hominem/db` and the shared `packages/core/db` migrations.
- Deployment uses the Railway/Docker shape used by `apps/web`.
