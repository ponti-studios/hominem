# Web sub-apps

**Status:** Accepted and cut over. Decisions D1–D6 are settled (section 9). The platform shell, the
Finance sub-app, and the Career sub-app are in place and browser-tested (`apps/web/tests/e2e/`); the
standalone `apps/finance` and `apps/career` deployments are removed. Moving the old custom domains onto
the web app is the one operational step left (6.4), plus the visual-parity screenshot pass.

**Direction:** Hominem stops shipping Finance and Career as standalone products and serves both as
sub-apps of `apps/web`. The platform shell owns identity, navigation, and cross-domain surfaces; each
domain owns its route subtree, UI, and client hooks. The API remains the only data boundary.

This document is the durable target architecture plus the migration plan that gets there. Once the
migration is complete, the plan sections collapse into [architecture.md](architecture.md) and this file
keeps only the sub-app contract.

---

## 1. Goal and constraint

The product move is one AI-native platform that can display and manage any domain of a person's life,
rather than a set of separately installed apps that happen to share a login.

The engineering constraint follows from that: **a platform can only host a domain whose screens are
pure clients of the API.** Career and Finance are not there yet — Career reads the database from its
React Router loaders (48 non-test files import `@hominem/db`), and Finance reaches into
`@hominem/finance-services` server-side for the ledger tools. Both patterns work inside a standalone
app. Neither survives being mounted inside a platform that already has its own SSR boundary, its own
auth shell, and its own deploy.

So the migration is not "copy routes into `apps/web`". It is:

1. Close the API gaps those apps currently fill by talking to the database directly.
2. Lift the screens into `apps/web` behind a shared shell as self-contained sub-apps.
3. Retire the two deployments.

Order matters: doing (2) before (1) means importing `@hominem/db` into `apps/web`, which is exactly the
seam we are trying to delete.

---

## 2. Current state

### 2.1 The three apps

| | `apps/finance` | `apps/career` | `apps/web` |
| --- | --- | --- | --- |
| Deploy | own Fly app + Dockerfile | own Fly app + Dockerfile | own Fly app + Dockerfile |
| Route modules | 19 | 41 | 13 |
| Tests | 12 | 26 | 5 |
| Data path | RPC (`@hominem/rpc/finance`) + one server-only service file | Direct `@hominem/db` in loaders/actions, plus AI/queues/storage in API-shaped routes | RPC (`useApiClient` → `HonoClient`) |
| Auth | hosted-login shims (`/auth`, `/auth/verify`, `/auth/logout`, `/auth/cli`) | hosted-login shims + `sessionMiddleware` | `sessionMiddleware` + hosted-login redirect, `allowedPrefixes` allowlist |
| Shell | `Navigation` with domain links + global search | `Navigation` + `NavigationProgress` + `PwaStatus` | per-route `RouteHeader`; no global nav |
| Styling | own black/gold theme overriding `--background`, `--card`, … in `globals.css` | `data-color-system="ponti"` default theme | `@ponti-studios/ui/styles.css` + local `components/ui`, **no** `data-color-system` / theme boot script |
| PWA | own service worker + manifest | own service worker + manifest | own service worker + manifest |

### 2.2 What the API already owns

`services/api/src/rpc/app.ts` already mounts `/career` and `/finance` next to every other domain, and
both have real service layers and MCP tools:

- `services/api/src/application/career.service.ts` — 60+ exported operations over
  `CareerRepository` (profile, engagements, applications + detail/notes/files, education, skills,
  projects, testimonials, certifications, social links, wishlist, worklog).
- `services/api/src/rpc/routes/career.*.ts` — 10 sub-routers exposing most of the above.
- `services/api/src/mcp/tools/career.ts` — ~35 career tools with `career:read` / `career:write` scopes.
- `services/api/src/application/finance.service.ts` + `finance.*.ts` sub-routers + `mcp/tools/finance*`.
- `CAPABILITIES` in `services/api/src/application/capability.ts` already lists `career` and `finance`
  as platform capabilities, with matching scopes in `services/api/src/scopes.ts`.

This is the single most important asset for the migration: **the platform's domain model and API
already exist.** The work is closing the specific holes the two apps still fill locally, then moving
presentation.

### 2.3 Where each app's data actually comes from

**Finance** — mostly already a client. 18 of 19 route modules and all hooks go through
`@hominem/rpc/finance` via `FinanceHonoProvider`. One file is the exception:

`apps/finance/app/lib/finance/ledger.server.ts` imports `@hominem/finance-services` directly and is
consumed by three routes:

| Route | Server functions |
| --- | --- |
| `routes/finance.reconcile.tsx` | `getLedgerReconcileData` (staleness + validation gates), `getLedgerBreakdown`, `postLedgerTrueUp` |
| `routes/finance.transfers.tsx` | `getLedgerTransferPairs` |
| `routes/finance.runway.tsx` | `getLiveRunway` (settings + `computeLedgerRunway`), `getRunwaySettings`, budget save/remove, currency save |

None of those are in `/api/finance`. `/api/finance/runway/*` is a different thing — generic
calculators plus runway *settings* — while `getLiveRunway` computes runway from the user's actual
ledger. `computeLedgerRunway` is reachable over MCP (`services/api/src/mcp/tools/finance.ts:377`) but
not over RPC, which is why the app bypassed HTTP in the first place.

**Career** — 41 route modules, of which the ones with loaders/actions are database clients:

- pages: `home`, `profile`, `account`, `work`, `work.$id`, `work.new`, `projects`, `projects.$id`,
  `projects.new`, `skills`, `testimonials`, `testimonials.$id`, `testimonials.new`,
  `applications`, `applications.new`, `applications.$id` (+ `_index`, `timeline`, `notes`, `files`,
  `resume`), `p.$slug`
- API-shaped route modules inside the app: `api.resume.convert`, `api.resume.analyze`,
  `api.resume.jobs.$jobId.stream`, `api.resume.customize`, `api.skills.derive`, `api.skills.search`,
  `api.validate-slug`, `api.portfolio.$userId`
- 11 `*.server.ts` modules: account loaders/actions, documents, resume import, portfolio, resume
  conversion, skills derivation, PDF text.

Several of these duplicate work the API or its worker already does:
`services/api/src/workers/resume-analysis.ts` runs the same PDF → AI → diff pipeline as
`apps/career/app/routes/api.resume.convert.ts` + `lib/services/resume-conversion.service.ts`.

---

## 3. Analysis: the seams

**S1 — Career's loaders are the platform's SSR boundary, twice.** Career resolves the session, reads
the database, and renders in one process. A sub-app inside `apps/web` resolves the session in web's
middleware and renders; its data must come over HTTP from the API. Porting a Career loader as-is
means `apps/web` gains `@hominem/db`, a database connection string, and a second writer to the same
tables — the opposite of a platform.

**S2 — Finance's ledger tools are a hole in the API, not a design choice.** The file's own comment
says the ledger tools "need no new API routes". That was true for a standalone app; inside a platform
it means either the API grows five endpoints or the web app inherits a finance services dependency.
The first is correct and also makes the ledger tools available to Omiro and MCP.

**S3 — Root-level route ownership collides.** Finance claims `/finance`, `/accounts`, `/analytics`,
`/account`. Career claims `/profile`, `/work`, `/projects`, `/skills`, `/testimonials`,
`/applications`, `/onboarding`, `/login`, `/p/:slug`, `/demo`, plus `/account`. Web claims `/tasks`,
`/collections`, `/settings`, `/usage`. Two apps both own `/account`; Career's generic nouns would
otherwise sit at the platform root and permanently constrain every future domain.

**S4 — Three shells, three PWA installs, three auth shims.** Each app ships its own navigation, its own
`/auth/*` routes, its own service worker, and its own manifest. Mounting the screens without
consolidating these produces nested navigation, competing service workers, and login redirects that
land back in the wrong app.

**S5 — Duplicated implementations drift.** The resume pipeline exists twice (API worker + Career
routes). Upload storage exists twice (`@hominem/storage` called from Career for application files,
versus `/api/files` upload flow). Two copies means two sets of bugs and two test suites.

**S6 — Theme divergence.** Finance overrides the port's design tokens with a fixed dark/gold palette
(`apps/finance/app/globals.css`) and forces `color-scheme: dark`. Career and web rely on the
`@ponti-studios/ui` default theme, and web does not set `data-color-system` at all. Three surfaces
rendering under one shell need one token contract, or the platform will visibly change the moment a
user crosses a domain boundary.

**S7 — Tests are written against the wrong boundary.** Finance tests mock
`~/lib/finance/ledger.server`; Career tests import `app/test/db/career`. Neither survives an
API-only data path. Tests must move down to the API (integration) and up to the component level
(MSW against the typed client), which is the pattern `apps/web` already has.

---

## 4. Target architecture

### 4.1 The one rule

> `apps/web` renders. `apps/api` owns data, authorization, AI, queues, and storage.
> A sub-app may import shared UI, shared types, and the RPC client — never `@hominem/db`,
> `@hominem/queues`, `@hominem/storage`, or a `*-services` package.

This rule is checkable: the migrated `apps/web/package.json` gains no `@hominem/db`, no
`@hominem/finance-services`, no `@hominem/career-services`, no `@hominem/queues`, no
`@hominem/storage`.

### 4.2 Sub-app anatomy

A sub-app is a route subtree plus a self-contained module. It is a folder boundary, not a second app:

```text
apps/web/app/
├── routes.ts                      # mounts each sub-app's route tree
├── routes/
│   ├── finance.tsx                # domain layout: sub-nav, auth guard
│   ├── finance._index.tsx
│   ├── finance.accounts.tsx
│   └── career.tsx
├── modules/
│   ├── finance/                   # everything finance-specific lives here
│   │   ├── components/
│   │   ├── hooks/                 # useQuery/useMutation wiring only
│   │   └── lib/                   # formatting, local state, view models
│   └── career/
└── domains.ts                     # the registry (4.3)
```

Rules that keep sub-apps from leaking into the platform:

- Domain components live under `modules/<domain>/`; only the route module in `routes/` may import
  them, and only `routes.ts` decides where they mount.
- Cross-domain imports are forbidden (lint rule or import-boundary check). Shared UI is promoted to
  `app/components/` deliberately, one component at a time.
- The platform shell owns navigation, identity, and notifications. Domain route destinations are
  registered in `domains.ts` and appear nested under the active domain in the shared sidebar. On
  desktop, the sidebar also owns the Hominem link, Jump to control, and account menu; there is no
  full-width app header. On narrow screens, the hierarchy opens in a modal navigation drawer from
  a compact header with the menu trigger and current page label. A sub-app layout must not render a
  second primary or section navigation row. No sub-app renders a `<html>` document, a
  `QueryClientProvider`, or a Toaster — those become platform-owned.
- No sub-app defines `/auth/*`. Web's `routes/auth/index.tsx` and `/logout` are the only auth
  surfaces; hosted login returns through Web's `allowedPrefixes` allowlist.

### 4.3 The domain registry

One module lists the platform's domains for navigation, the home surface, and later the agent's
context:

```ts
type Domain = {
  id: 'finance' | 'career' | 'tasks' | 'collections'; // grows
  label: string;
  path: string;
  icon: LucideIcon;
  capability?: 'finance' | 'career'; // aligns with api CAPABILITIES
  enabled: boolean;
};
```

Nav, the home dashboard, and the account menu all read from it. This is deliberately client-side and
dependency-free; it is *not* a second source of truth for authorization (the API scopes are) and not a
second source of truth for capabilities (`CAPABILITIES` in the API is). It maps one to the other.

YAGNI guard: do not build a runtime plugin loader, module federation, or per-domain bundles beyond
React Router's existing route-level code splitting.

### 4.4 Data access patterns

Two patterns, chosen per page, never mixed inside one route module:

1. **Client query (default).** `useQuery`/`useMutation` over `useApiClient()` with the typed
   `HonoClient`, as `apps/web/app/hooks/use-tasks.ts` does today. Best for interactive pages,
   optimistic updates, and anything already React Query.
2. **SSR loader (only when the server must know).** A `loader` that resolves `userContext` and calls
   the API with `createServerHonoClient(request, serverEnv.HOMINEM_INTERNAL_API_URL)`. Best for
   first-paint-critical data and auth-gated redirects.

After any API route change, `pnpm --filter @hominem/api build` — `packages/rpc` resolves against the
committed `services/api/build/rpc/app.d.ts`, not live source (see `AGENTS.md`).

Response types are derived with `InferResponseType`, never hand-written and cast (see
`packages/rpc/src/types/tasks.types.ts`, `chat.types.ts`).

### 4.5 Styling

- Web owns the single token boot script and `data-color-system`; sub-apps do not repaint it.
- Finance's palette becomes a **scoped theme class** on the finance subtree (`data-domain="finance"`),
  not a global override. Decision D4 covers whether to keep it at all.
- `@ponti-studios/ui` components are allowed in migrated screens; local `app/components/ui` primitives
  remain for platform chrome. A screen picks one and stays consistent within its module.

### 4.6 Public and auth surfaces

- Public pages (Career's `/p/:slug`, `/demo`) mount outside `routes/_authenticated.tsx`. Web's
  middleware already lets unauthenticated requests through; only `requireAuthMiddleware` blocks.
- `webAuthConfig.allowedPrefixes` in `apps/web/app/lib/hosted-auth.server.ts` must list every new
  prefix, or a logged-out deep link bounces to `/tasks`.
- The external PDF worker currently called from
  `apps/career/app/components/account/ProfilePage.tsx:132` (`https://career-worker.fly.dev/trigger-task`,
  hardcoded) takes a public profile URL. Whatever public URL Career's profile ends up on (D2), that
  callback must become configuration and must survive the domain change.

---

## 5. Migration strategy

Six phases. Each phase ends with the full gate from `AGENTS.md` (`pnpm run check`, `pnpm format:check`)
for every affected package and its dependents, plus the phase's own exit criteria.

### Phase 0 — Lock the decisions

Resolve D1–D6 (section 9), then update the durable docs that record them before writing code:
`docs/architecture.md` (data-path table currently documents "Career route's loaders access the
database directly"), `docs/web-design-direction.md` if the shell changes page composition, and this
file.

**Exit:** decisions recorded; no code moved.

### Phase 1 — Platform shell

Build the shell the sub-apps will mount into, using the existing Tasks and Collections screens as the
first tenants so the shell is proven before new code arrives.

- `routes/layout.tsx` owns the single navigation hierarchy driven by `domains.ts`. The desktop
  sidebar contains the brand link, navigation, Jump to control, and account menu; the full-width app
  header is absent.
- The four root domains remain visible in the desktop sidebar. The active domain's registered child
  routes appear directly beneath it; the root route is represented by the domain link itself. On
  narrow screens, this hierarchy is shown in a drawer opened from a compact page header. Sub-app
  layouts do not add a second navigation surface.
- Move `QueryClientProvider` to the root provider stack so sub-apps stop creating their own; keep
  `getQueryClient()` SSR-safe.
- Unify telemetry (`@hominem/telemetry` is already in web) and PWA policy (section 6.3).

**Exit:** Tasks, Collections, Settings and Usage work unchanged under the new shell; `/tasks` is still
the authenticated home until D3 says otherwise; no sub-app code yet.

### Phase 2 — Close the API gaps (both domains)

This is the phase that makes the migration possible. No UI work.

**Finance** — add a `ledger` sub-router under `/api/finance` and a service module that is the single
implementation behind the routes and the existing MCP `finance_runway` tool:

| New RPC endpoint | Service (from `@hominem/finance-services`) | Replaces |
| --- | --- | --- |
| `GET /api/finance/ledger/reconcile` | `getReconciliationStaleness`, `getValidationGates` | `getLedgerReconcileData` |
| `GET /api/finance/ledger/accounts/:id` | `getAccountLedgerBreakdown` | `getLedgerBreakdown` |
| `POST /api/finance/ledger/adjustment` | `postReconciliationAdjustment` | `postLedgerTrueUp` |
| `GET /api/finance/ledger/transfers` | `findTransferPairs` | `getLedgerTransferPairs` |
| `GET /api/finance/ledger/runway` | `getRunwaySettings` + `computeLedgerRunway` | `getLiveRunway` |

Also fix the latent defect this migration surfaces: `apps/finance/app/routes/account.tsx:39` calls
`DELETE /api/finance` on the Finance app's own origin, but no such route exists in
`apps/finance/app/routes.ts`; the API exposes data deletion as
`POST /api/finance/data` with a confirmation body (`services/api/src/rpc/routes/finance.data.ts`).
Verify current production behavior, then make the migrated screen call the typed client.

**Career** — close the eight holes that only the app fills:

| New RPC endpoint | Replaces | Notes |
| --- | --- | --- |
| `PATCH /api/career/profile` | `account.actions.server` profile saves | service `updateCareerProfile` already exists |
| `GET /api/career/portfolio/:slug` | `routes/p.$slug.tsx` loader | public, no auth; owner-scoped service read |
| `GET /api/career/documents` | `lib/account/documents.server.ts` | reuse `/api/files` listing if equivalent |
| `POST /api/career/resume/convert` | `routes/api.resume.convert.ts` | move AI + storage + save into the API; reuse `workers/resume-analysis` pipeline |
| `POST /api/career/resume/analyze` | `routes/api.resume.analyze.ts` | returns job id |
| `GET /api/career/resume/jobs/:id/stream` | `routes/api.resume.jobs.$jobId.stream.ts` | SSE; document the transport in the API |
| `POST /api/career/resume/customize` | `routes/api.resume.customize.ts` | AI call belongs in the API, not a UI host |
| `POST /api/career/skills/derive`, `GET /api/career/skills/search` | `api.skills.*` | reuse `application/career.service.ts` + `@hominem/ai` |
| `GET /api/career/profile/slug-available` | `api.validate-slug` | |
| `POST /api/career/applications/:id/files/upload` | `applications.$id.files` action | compose `/api/files` upload + existing `files/create` |

Every row: schema in `services/api/src/schemas/career.schema.ts`, implementation in
`application/career.service.ts` (or a sibling service), thin route + MCP adapter, integration test.
Follow the `hominem-resource` skill. Delete the app-local duplicate in the same change so there is
never a second copy.

**Exit:** `apps/finance` and `apps/career` can be made read-only by deleting their server-only files;
both apps still render, now entirely over RPC. Their local DB/AI/queue imports drop to zero. API
integration tests cover every new endpoint.

### Phase 3 — Finance sub-app (first tenant)

Finance goes first: 18/19 routes are already clients, the surface is small, and it proves the shell
against a data-dense domain.

1. Move `components/finance`, `components/accounts`, `components/analytics`, `components/budget-overview`,
   `components/category-select`, `components/account-select`, `components/transaction-filters`,
   `components/route-link` into `modules/finance/components`.
2. Move `lib/hooks/*`, `lib/types/account.types.ts`, `lib/finance/inputs.ts`, `lib/number.utils.ts`
   into `modules/finance`.
3. Port the 19 route modules to `routes/finance.*` with URLs `/finance`, `/finance/analytics`,
   `/finance/accounts`, `/finance/accounts/:id`, `/finance/runway`, `/finance/affordability`,
   `/finance/reconcile`, `/finance/transfers`. Drop `auth.*`, `home`, `account`, `layout` (replaced by
   the platform shell and `/settings`).
4. Replace the three `ledger.server` call sites with Phase 2 endpoints.
5. Port the 12 tests: route/view tests to `apps/web` against MSW; ledger behavior stays in API
   integration tests.
6. Retire Finance's `@hominem/finance-services` usage; web must not gain that dependency.

**Exit:** every finance screen renders under the platform shell with parity (including the spending
chart, runway simulator, and reconcile true-up), tests pass in `apps/web`, and `apps/finance` has no
unique functionality left.

### Phase 4 — Career sub-app

Career is the larger surface (41 modules), so sequence by dependency, not by file order:

1. **Foundation** — profile + account + social links + certifications + documents. Everything else
   links to these, and the Career `account` page merges into the platform's `/settings` or a
   `/career/profile` surface (D5).
2. **Collections** — work, projects, skills, testimonials (list/new/detail). These are
   straightforward CRUD over existing endpoints and prove list/detail routing under the domain
   layout.
3. **Applications** — list, new, detail with `timeline`, `notes`, `files`, `resume` children. The
   detail endpoint already returns `stages` and `offers`
   (`application/career.service.ts:287`), so the tabs become client views.
4. **AI flows** — resume convert/analyze/customize, skills derive/search, slug availability. These
   move *after* Phase 2 so the screens are thin and the streaming transport is API-owned.
5. **Onboarding** — the create-first-profile flow, reusing the migrated resume converter.
6. **Public** — `/p/:slug` and `/demo`, outside the auth layout, with the PDF-worker hook updated to
   configuration.

Port Career's 26 tests along the same split: component/route tests in web over MSW, data behavior in
API integration tests. Delete `apps/career/app/test/db` — it only exists because loaders own queries.

**Exit:** all 41 route modules have a web equivalent or a documented deletion; no screen imports
`@hominem/db`; public profile renders on the platform origin and the PDF worker still succeeds.

### Phase 5 — Deprecate the standalone apps

Only after Phase 3 and Phase 4 exit.

1. Remove: `apps/finance`, `apps/career`, their Dockerfiles, `validate-finance.yml`,
   `validate-career.yml`, `dev:finance` / `dev:career` scripts, turbo entries, `just/ui.just`
   `ui_consumers`, `.env.example` files. Neither app has a `deploy-*.yml` in `.github/workflows`
   today (only `validate-*` with a `docker-build` job), so also remove whatever manual Fly app and
   `FLY_*` variables backed the deployments.
2. Update `docs/architecture.md`'s data-path table and the root `AGENTS.md` repo structure list. Add
   the sub-app rule to the "Adding a new package, app, or service" guidance.
3. Keep `packages/finance` and `packages/career` — they are the domain logic behind the API and
   should remain the single implementation.

**Exit:** the monorepo builds and tests without either app; the old hostnames are retired (their
custom domains were removed, so there is no redirect layer to own); the docs match reality.

### Phase 6 — Platform integration (post-migration, not required to retire the apps)

- Home surface shows domains from the registry with meaningful summaries (net worth, runway, next
  application stage), each fetched from the API the domain already exposes.
- Account menu and a command palette navigate across domains.
- Agent surfaces already exist over MCP; the platform UI should link to them rather than duplicate
  chat-in-page until there is a product decision to do so.

YAGNI: no per-domain theming system, no cross-domain widget framework, no server-side composition
layer. Add the second consumer before generalizing.

---

## 6. Compatibility and deprecation

The platform paths are the only addresses now. `apps/finance` and `apps/career` were deleted and their
custom domains retired, so the old finance/career hostnames no longer resolve and there is no redirect
layer to maintain. Anyone following an old bookmark has to navigate to the platform origin.

Two contract points still matter:

- `/p/:slug` is unchanged, so shared portfolio links keep working on the platform origin (D2).
- Web login is the only auth surface; `webAuthConfig.allowedPrefixes` includes `/finance`, `/career`,
  and `/p`, so a logged-out deep link returns to the page after OTP verification.

There is no service-worker migration either: the retired origins are gone, and the platform owns a
single worker on its own origin. Data was never stranded in the old apps — by the end they were API
clients, so the same API and database hold everything.

## 7. Testing and evidence

Per phase, following `hominem-evidence`:

- **API (Phase 2 + every endpoint added later):** integration tests beside the service and route
  (`*.service.test.ts`, `*.test.ts`), including owner scoping for the new public portfolio endpoint
  and negative cases for the confirmation-guarded data deletion.
- **Web (Phases 3–4):** component and route tests with MSW against the typed client; Playwright specs
  in `apps/web/tests/e2e` for the cross-domain journeys that matter — log in once, move between
  Tasks and Finance, open a Career application, load a public profile logged out.
- **Parity evidence:** for each migrated screen, a note in the task record comparing old and new
  behavior (including empty, error, and loading states), with a screenshot where the visual result is
  meant to change (D4).
- **Gate:** `pnpm run check` + `pnpm format:check` for `@hominem/web...` and `@hominem/api...` on every
  phase; the full repo gate before Phase 5 removal.

---

## 8. Risks

| Risk | Why it bites | Mitigation |
| --- | --- | --- |
| Porting DB code into `apps/web` | Fastest local fix, creates a second writer and a second schema consumer | Phase 2 is a hard prerequisite; add a dependency check that fails if `@hominem/db` appears in web |
| Finance theme (S6/D4) | A data-dense dark surface dropped into a light shell | Scope tokens to `[data-domain="finance"]`; screenshot parity per screen |
| Bundle growth from `recharts`, `react-image-crop`, `simple-icons` | Platform first load regresses | Route-level code splitting; keep heavy deps inside the domain module; check the bundle visualizer (`ANALYZE=true`) |
| SSE resume streaming through a new origin | Stream breaks behind proxies or auth redirects | Phase 2 owns the transport; test through the same path the app will use |
| External PDF worker's hardcoded origin | Public profile PDF silently breaks | Make the worker URL config, test one real generate after Phase 4 |
| Two implementations of resume pipeline | Behavior drift and double AI spend | Delete app-local pipeline in the same commit as the API route |
| Public profile SEO/history | Shared links break | Keep `/p/:slug` at the platform root (D2) |
| Redirect-only deprecation leaves API keys/flows in old envs | Zombie deploys | Phase 5 removes Fly apps, workflows, and secrets explicitly |

---

## 9. Decisions

Settled 2026-11-05. The option letters match the alternatives considered in the original proposal.

### D1 — URL namespacing: prefix by domain

Every sub-app owns `/<domain>/*`; root paths stay platform-owned (`/tasks`, `/collections`,
`/settings`). Finance moves to `/finance/*` (including `/finance/analytics` and `/finance/accounts`),
Career to `/career/*`. No sub-app may claim a root-level generic noun.

### D2 — Public profile URL: keep `/p/:slug`

Career's public profile stays at the platform root so existing shared links and the PDF worker keep
working. The retired career host is not redirected — the domain was removed — so anything still
pointing at it must be updated to the platform origin. The worker's hardcoded
`https://career-worker.fly.dev/trigger-task` call became configuration in the same change that moved
the profile route.

### D3 — Root destination: keep `/tasks`

`/` continues to redirect to `/tasks` through the migration. A platform home that summarizes domains
is Phase 6 work, after the domains are actually served from the platform.

### D4 — Finance theme: adopt platform theming

Finance adopts the platform's token contract. The black/gold palette survives only as a scoped accent
on the finance subtree (`data-domain="finance"`), never as a global override or a forced
`color-scheme: dark`. Visual parity is judged screen by screen against the old app.

### D5 — Profile vs settings: domain profile, platform settings

Career's content profile stays at `/career/profile`. Both apps' `/account` screens collapse into the
existing platform `/settings` surface (which already redirects to the API-hosted account page).
Finance keeps no account screen of its own.

### D6 — Demo and prototype: delete both

`/demo` and `/prototypes/application-cockpit` are not migrated. The prototype is superseded by the
real application pages; the mock portfolio is not part of the platform.

---

## 10. Non-goals

- Rewriting Finance or Career UI during the move. Parity first; restyling follows the platform design
  direction as separate work.
- Merging `packages/finance` / `packages/career` into the API. They are already the shared
  implementation the API adapts.
- Moving Omiro. It is already an RPC client and benefits automatically once the API owns the gaps.
- A micro-frontend architecture, module federation, or per-domain deployments. One app, one shell, one
  deploy.
