# P1 Runtime And Environment

Status: proposed
Goal: make local, CI, Docker, Railway, and EAS agree on runtime and configuration truth

## Summary

P1 is about removing drift between the places that define how the repo runs. Right now, the command system is cleaner than the runtime environment beneath it. The next step is to make Node, pnpm, env schemas, release constants, and generated artifacts boring and centralized.

## Findings

### Node Versions Drift Across Environments

The workspace pins Node through pnpm config, but Dockerfiles use a different major version.

Evidence:

- [pnpm-workspace.yaml](/Users/charlesponti/Developer/hominem/pnpm-workspace.yaml)
- [services/api/Dockerfile](/Users/charlesponti/Developer/hominem/services/api/Dockerfile)
- [apps/career/Dockerfile](/Users/charlesponti/Developer/hominem/apps/career/Dockerfile)

Required shape:

- Pick one Node line for local, CI, Docker, and deploy.
- Prefer the pnpm-pinned version as the source of truth unless production has a concrete reason to differ.
- Keep `packageManager` and CI setup aligned with Expo/EAS expectations.

### Env Schema Ownership Is Split

`@hominem/env` exists, but API RPC code, apps, and storage still define separate env schemas or variable names.

Evidence:

- [packages/env/src/api.ts](/Users/charlesponti/Developer/hominem/packages/env/src/api.ts)
- [packages/env/src/web.ts](/Users/charlesponti/Developer/hominem/packages/env/src/web.ts)
- [services/api/src/rpc/lib/env.ts](/Users/charlesponti/Developer/hominem/services/api/src/rpc/lib/env.ts)
- [apps/finance/app/lib/env.ts](/Users/charlesponti/Developer/hominem/apps/finance/app/lib/env.ts)
- [apps/career/app/lib/env.ts](/Users/charlesponti/Developer/hominem/apps/career/app/lib/env.ts)
- [packages/storage/src/env.ts](/Users/charlesponti/Developer/hominem/packages/storage/src/env.ts)

Known drift:

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_API_URL`
- `EXPO_PUBLIC_API_BASE_URL`
- API has both canonical API env and a second RPC env schema.

Required shape:

- `@hominem/env` owns shared schema definitions.
- Apps may adapt framework-specific prefixes, but variable meaning should be named once.
- Production secrets should be required in production, not silently defaulted.
- Development defaults should be explicit and documented.

### Turbo Env Inputs Are Both Too Broad And Incomplete

`turbo.json` includes broad global env inputs and `.env` files, which increases cache churn. At the same time, source inspection found env variables used in code that are not represented in the Turbo env contract.

Evidence:

- [turbo.json](/Users/charlesponti/Developer/hominem/turbo.json)

Observed env usage includes:

- `PORT`
- `CAREER_URL`
- `AUTH_TEST_OTP_ENABLED`
- `MCP_ENABLED_SCOPES`
- `MCP_DAILY_COST_BUDGET_CENTS`
- Plaid variables
- Omiro `EXPO_PUBLIC_*`
- model-specific OpenRouter variables

Required shape:

- Move env inputs closer to the tasks that need them.
- Server tasks should care about server env.
- Omiro tasks should care about `EXPO_PUBLIC_*`, EAS, and app release env.
- UI/utils/package checks should mostly not care about product env.

### Omiro Release Constants Are Duplicated

The Omiro runtime version appears in script/config/docs and must be manually kept in sync.

Evidence:

- [apps/omiro/app.config.ts](/Users/charlesponti/Developer/hominem/apps/omiro/app.config.ts)
- [apps/omiro/eas.json](/Users/charlesponti/Developer/hominem/apps/omiro/eas.json)
- [scripts/command](/Users/charlesponti/Developer/hominem/scripts/command)
- [apps/omiro/README.md](/Users/charlesponti/Developer/hominem/apps/omiro/README.md)

Required shape:

- Keep Apple-only support.
- Move runtime/channel constants into one checked config.
- Make `app.config.ts` and command scripts read from that source.

### Generated Artifacts Need A Clear Policy

Most package exports point at `src`, but generated DB types still need to be current. There are also stale-looking `build/` folders in package directories that are not the active export target.

Evidence:

- [packages/db/src/types/database.ts](/Users/charlesponti/Developer/hominem/packages/db/src/types/database.ts)
- [packages/db/build](/Users/charlesponti/Developer/hominem/packages/db/build)
- [packages/ai/build](/Users/charlesponti/Developer/hominem/packages/ai/build)
- [packages/chat/build](/Users/charlesponti/Developer/hominem/packages/chat/build)

Required shape:

- Source-first packages should not carry ignored/stale build artifacts as if they are runtime truth.
- Generated files should be explicitly documented and CI-checked.
- Production deployables should build from source into their deployment artifacts.

## Implementation Checklist

- [ ] Pin one Node version across pnpm, CI, Docker, Railway, and EAS.
- [ ] Remove duplicate API RPC env schema or merge it into `@hominem/env`.
- [ ] Standardize public API URL variable naming.
- [ ] Split Turbo env inputs by task/product.
- [ ] Centralize Omiro runtime/channel constants.
- [ ] Document generated DB types and add drift checking.
- [ ] Remove stale build artifacts if they are not part of the source-first package model.

## Validation

```bash
just setup
just check api
just check mobile
just db validate test
pnpm exec turbo run build --dry=json
```

Also inspect Docker and EAS logs after runtime alignment to confirm they resolve the same Node and pnpm versions.
