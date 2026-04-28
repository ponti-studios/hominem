# Migration Plan: From Apps/Packages to Surfaces

---

## Overview

Moving from:

```
apps/web
apps/mobile
services/api
packages/core/...
packages/platform/...
packages/domains/...
```

To:

```
surfaces/
  browser/
  mobile/
  http/
  workers/

shared/...
```

This is mostly renaming and path updates. Here's how to do it without breaking things.

---

## Phase 0: Preparation

Before moving anything, get a complete picture of what will change.

### What needs updating

1. **Directory renames** — the physical folder moves
2. **package.json names** — the `@hominem/*` scope stays, but paths change
3. **tsconfig.json references** — project path updates
4. **pnpm-workspace.yaml** — workspace includes
5. **Import statements** — any absolute imports that use old paths
6. **Scripts and configs** — hardcoded paths in justfiles, docker, CI, etc.
7. **Documentation** — any docs that reference the old structure

### Audit commands

Run these to see what uses the old paths:

```bash
# Find imports using old paths
rg -l 'packages/core/|packages/platform/|packages/domains/' --type ts --type tsx

# Find config references
rg -l '"packages/(core|platform|domains|apps|services)/' --type json

# Find script references
rg -l 'packages/(core|platform|domains|apps|services)/' --type justfile
```

---

## Phase 1: Directory Moves

Move each directory to its new location. Do this in one go or incrementally — both work.

### Direct mapping

| Old | New |
|---|---|
| `apps/web` | `surfaces/browser/` |
| `apps/mobile` | `surfaces/mobile/` |
| `services/api` | `surfaces/http/` |
| `packages/core/db` | `shared/db/` |
| `packages/core/env` | `shared/env/` |
| `packages/core/storage` | `shared/storage/` |
| `packages/core/utils` | `shared/utils/` |
| `packages/platform/auth` | `shared/auth/` |
| `packages/platform/queues` | `shared/queues/` |
| `packages/platform/rpc` | `shared/rpc/` |
| `packages/platform/services` | `shared/services/` |
| `packages/platform/telemetry` | `shared/telemetry/` |
| `packages/platform/ui` | `shared/ui/` |
| `packages/domains/chat` | `shared/chat/` |

### Workers

Workers don't exist yet as a directory, but they'll go here:

```
surfaces/workers/
  import-transactions-csv/
  generate-image/
```

The queue setup from `packages/platform/queues` goes to `shared/queues/`.

### One-liner (if you want to do it all at once)

```bash
# Dry run first
mkdir -p surfaces/shared

# Move apps
mv apps/web surfaces/browser
mv apps/mobile surfaces/mobile

# Move services
mv services/api surfaces/http

# Move packages/core (keep core as shared)
mv packages/core/db shared/db
mv packages/core/env shared/env
mv packages/core/storage shared/storage
mv packages/core/utils shared/utils

# Move packages/platform
mv packages/platform/auth shared/auth
mv packages/platform/queues shared/queues
mv packages/platform/rpc shared/rpc
mv packages/platform/services shared/services
mv packages/platform/telemetry shared/telemetry
mv packages/platform/ui shared/ui

# Move packages/domains
mv packages/domains/chat shared/chat

# Clean up old empty dirs
rm -rf apps packages packages/core packages/platform packages/domains services
```

---

## Phase 2: Configuration Updates

After the directories move, update the configs that reference them.

### pnpm-workspace.yaml

```yaml
packages:
  - 'surfaces/*'
  - 'shared/*'
```

### tsconfig.json

Update all project references:

```json
{
  "references": [
    { "path": "shared/auth" },
    { "path": "shared/chat" },
    { "path": "shared/db" },
    { "path": "shared/env" },
    { "path": "shared/storage" },
    { "path": "shared/rpc" },
    { "path": "shared/services" },
    { "path": "shared/ui" },
    { "path": "shared/utils" },
    { "path": "shared/telemetry" },
    { "path": "surfaces/browser" },
    { "path": "surfaces/mobile" },
    { "path": "surfaces/http" }
  ]
}
```

### turbo.json

Update any path globs in turbo.json:

```json
{
  "pipeline": {
    "build": {
      "inputs": ["surfaces/**", "shared/**"]
    }
  }
}
```

---

## Phase 3: Package.json Updates

Each package.json probably doesn't need changes — the package name (`"name": "@hominem/..."`) stays the same. Only the location on disk changes.

But double-check that exports still resolve correctly, especially for subpath exports:

```json
// Example: @hominem/ui package.json
"exports": {
  "./button": "./src/components/button.tsx"
}
```

The path stays relative to the package location, so it doesn't change.

---

## Phase 4: Import Path Updates

Search for any absolute imports that use the old paths and update them.

```bash
# Find them
rg "@hominem/(core|platform|domains)" --type ts --type tsx

# Examples of what to find:
import { something } from "@hominem/core/db"
import { something } from "@hominem/platform/auth"
```

These become:

```ts
import { something } from "@hominem/db"
import { something } from "@hominem/auth"
```

The npm package names stay `@hominem/*` — you just won't have the intermediate folders in the name anymore.

---

## Phase 5: Scripts and Configs

Update anything with hardcoded paths.

### justfile

```just
# Old
build:
  pnpm --filter packages/core/db build

# New
build:
  pnpm --filter shared/db build
```

### Docker / Railway / etc.

Check:
- `services/api/railway.json`
- `services/api/worker/railway.json`
- `apps/web/railway.json`

Any path references like `"/packages/**"` become `"/shared/**"` or `"/surfaces/**"`.

### CI configs

Check `.github/workflows/` for path filters.

```yaml
# Old
paths:
  - 'packages/core/**'

# New
paths:
  - 'shared/**'
```

---

## Phase 6: Documentation Updates

Update any docs that reference the old structure:

- `README.md` — likely mentions "apps" and "packages"
- `AGENTS.md` — any path references
- This doc — once finalized

```bash
# Find docs that need updating
rg -l 'packages/(core|platform|domains|apps|services)' --type md
```

---

## Phase 7: Verify

After everything's moved, make sure the repo still works.

### Basic checks

```bash
# Typecheck everything
pnpm turbo typecheck

# Build everything
pnpm turbo build

# If you have tests
pnpm turbo test
```

### Specific verifications

```bash
# Confirm old paths are gone
ls apps/
ls packages/

# Confirm new paths exist
ls surfaces/
ls shared/

# Check imports still resolve
pnpm ls @hominem/db
pnpm ls @hominem/ui
```

---

## Gotchas

### 1. tsconfig paths

If you use path aliases like `"@hominem/core/*"`, you'll need to update those too.

In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@hominem/db": ["./shared/db/src/index.ts"]
    }
  }
}
```

### 2. Mobile app mapping

The mobile app (`surfaces/mobile/`) uses path mapping for some UI components:

```json
"@hominem/ui/button": ["./shared/ui/src/components/ui/button.native.tsx"]
```

Update these to point to the new location.

### 3. Storybook

If `storybook-static` is built, delete it from the old `packages/platform/ui` location and rebuild from `shared/ui`.

### 4. Node modules

You might want to clean and reinstall:

```bash
rm -rf node_modules
pnpm install
```

---

## Rollback Plan

If something goes wrong:

```bash
# Move everything back
mv surfaces/browser apps/web
mv surfaces/mobile apps/mobile
mv surfaces/http services/api
# ... repeat for all

# Move packages back
mv shared/db packages/core/db
# ... repeat for all
```

The package names in `package.json` don't change, so npm/pnpm will still resolve them. This is why we don't change the npm scope — it makes rollback easy.

---

## Timeline

This can be done in a few hours if everything goes smoothly. Plan for:

- Phase 1 (directory moves): 30 min
- Phase 2-3 (configs): 30 min
- Phase 4 (imports): 15 min
- Phase 5 (scripts): 15 min
- Phase 6 (docs): 15 min
- Phase 7 (verify): 30 min

Total: ~2 hours if you're careful, longer if you hit edge cases.

---

## Post-Migration

After everything works:

1. Delete this plan doc (or move it to docs/archived/)
2. Update MONOREPO-STRUCTURE.md to be the source of truth
3. Commit with message like "refactor: migrate to surfaces/shared structure"
4. Tell everyone the paths have changed

---

*Run this locally first. Don't try to migrate CI at the same time as local.*