# Engineering Architecture

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | React Router v7 | SSR, file-based routing |
| Language | TypeScript | Strict |
| UI components | `@hominem/ui` | Shared workspace package |
| Database ORM | `@hominem/db` | Wraps Drizzle + shared `packages/core/db` schema |
| File storage | Cloudflare R2 (prod) / MinIO (local) | Auto-selected by env vars |
| Auth | Shared `withAuthLoader` | Session-based; see `~/lib/route-utils` |
| Testing | Vitest | Unit + integration |
| Linting | oxlint | |
| Formatting | oxfmt | |
| Deployment | Railway (Docker) | `Dockerfile` at app root |

## Repository Layout

```
apps/career/
├── app/
│   ├── routes/       ← file-based routes
│   ├── components/
│   ├── lib/          ← business logic, queries, utils
│   └── types/
├── scripts/
├── test/
├── Dockerfile
└── docker-compose.yml  (local Postgres + MinIO)
```

## Route Map

| Route file | Path | Purpose |
|------------|------|---------|
| `career.tsx` | `/career` | Overview: salary chart, progression stats, history |
| `career.experience.$id.tsx` | `/career/experience/:id` | Role detail |
| `career.experience.$id.projects.tsx` | `/career/experience/:id/projects` | Projects within a role |
| `career.applications.tsx` | `/career/applications` | Application list |
| `career.applications.$id.tsx` | `/career/applications/:id` | Application detail |
| `career.applications.create.tsx` | `/career/applications/create` | New application form |
| `career.certifications.tsx` | `/career/certifications` | Certification list |
| `career.projects.tsx` | `/career/projects` | Side project list |
| `editor.tsx` | `/editor` | Portfolio editor shell |
| `editor.basic.tsx` | `/editor/basic` | Bio, headline, slug |
| `editor.work.tsx` | `/editor/work` | Work history in portfolio |
| `editor.skills.tsx` | `/editor/skills` | Skills |
| `editor.projects.tsx` | `/editor/projects` | Projects in portfolio |
| `editor.social.tsx` | `/editor/social` | Social links |
| `editor.stats.tsx` | `/editor/stats` | Stats / highlights |
| `editor.testimonials.tsx` | `/editor/testimonials` | Testimonials |
| `api.resume.convert.ts` | `/api/resume/convert` | Résumé PDF conversion |
| `api.resume.customize.ts` | `/api/resume/customize` | AI résumé customization |
| `api.job.scrape.ts` | `/api/job/scrape` | Job description scraper |
| `api.applications.create.ts` | `/api/applications/create` | Application creation API |
| `api.portfolio.$userId.ts` | `/api/portfolio/:userId` | Public portfolio data |
| `api.validate-slug.ts` | `/api/validate-slug` | Slug uniqueness check |
| `demo.tsx` | `/demo` | Public portfolio view |
| `home.tsx` | `/` | Landing / authenticated home |

## Data Flow

```
Browser → React Router loader/action
  → withAuthLoader (session validation)
  → @hominem/db (Drizzle queries against PostgreSQL)
  → Response
```

File uploads go through a dedicated API route → R2/MinIO.

AI features (résumé customization, job scraping) call out to LLM APIs from server-side route handlers.

## Key Conventions

- All imports from within the app use the `~/` alias
- Auth protection uses `withAuthLoader` from `~/lib/route-utils` — never roll custom session checks
- Database queries live in `~/lib/career/queries/`; keep route files thin
- Shared DB schema lives in `packages/core/db` — never duplicate table definitions here
