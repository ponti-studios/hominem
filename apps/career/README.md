# Hominem Career

A self-contained React Router career tracking app migrated from CraftD into the Hominem workspace.

## Quick Start

```bash
pnpm install
cp apps/career/.env.example apps/career/.env
docker compose -f apps/career/docker-compose.yml up -d db minio minio-init
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/craftd_dev just db-migrate
pnpm --filter @hominem/career dev
```

`just db-migrate` runs the shared monorepo migrations from `packages/core/db/migrations`.
Local file uploads use the MinIO service from `apps/career/docker-compose.yml` when Cloudflare R2 env vars are not set.

The dev server runs on `http://localhost:4451`.

## Configuration

Required environment variables:

```dotenv
VITE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/craftd_dev
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/craftd_dev
VITE_PUBLIC_API_URL=http://localhost:3000
```

Cloudflare R2 is only required for deployed environments. Local development uses MinIO by default.

## Commands

| Need                         | Run                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Start dev server             | `pnpm --filter @hominem/career dev`                                                     |
| Build                        | `pnpm --filter @hominem/career build`                                                   |
| Serve build                  | `pnpm --filter @hominem/career start`                                                   |
| Typecheck                    | `pnpm --filter @hominem/career typecheck`                                               |
| Lint                         | `pnpm --filter @hominem/career lint`                                                    |
| Format                       | `pnpm --filter @hominem/career format`                                                  |
| Test                         | `pnpm --filter @hominem/career test`                                                    |
| Start local Postgres + MinIO | `docker compose -f apps/career/docker-compose.yml up -d db minio minio-init`            |
| Stop local services          | `docker compose -f apps/career/docker-compose.yml down`                                 |
| Run shared migrations        | `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/craftd_dev just db-migrate` |

## Notes

- Database access now goes through `@hominem/db` and the shared `packages/core/db` migrations.
- Shared monorepo Postgres URLs use `127.0.0.1:5434` (`hominem` for dev, `app-test` for test). This app’s standalone `docker-compose.yml` keeps its own local database on `127.0.0.1:5432/craftd_dev`.
- Local uploads use MinIO; deployed environments should configure Cloudflare R2 with `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.
- Deployment uses the repo-level `validate-career` and `deploy-career` workflows with the same Railway/Docker shape as `apps/web`. The deploy workflow expects `RAILWAY_SERVICE_CAREER` and `RAILWAY_TOKEN` secrets.
