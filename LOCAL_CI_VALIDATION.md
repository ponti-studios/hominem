# Local CI Validation Guide

This guide helps you validate that your changes will pass CI before pushing, saving GitHub Actions credits and preventing wasted builds.

**TL;DR:** Run this before pushing:
```bash
./scripts/validate-before-push.sh
```

---

## Quick Start

### 1. Setup (One-time)

#### Install Required Tool Versions

```bash
# Using asdf (recommended)
asdf install bun 1.3.0
asdf install nodejs 22.14.0
asdf install just 1.36.0

# Set as local versions
asdf local bun 1.3.0
asdf local nodejs 22.14.0
asdf local just 1.36.0

# Verify
bun --version     # 1.3.0
node --version    # v22.14.0
just --version    # 1.36.0
```

If you don't have `asdf`:
- **macOS:** `brew install asdf`
- **Linux:** https://asdf-vm.com/guide/getting-started.html
- **Alternative:** Download directly from https://bun.sh, https://nodejs.org, https://just.systems

#### Start Docker Services

```bash
# Start all required services (Redis, PostgreSQL, Jaeger)
docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d

# Verify services are healthy
docker compose ps

# Expected output (all should show "healthy" or "running"):
# NAME         STATUS
# redis        running
# postgres     running
# postgres-test running
# jaeger       running
```

#### Create Environment File

```bash
# Copy template
cp infra/compose/.env.example infra/compose/.env

# Verify file exists
cat infra/compose/.env
```

### 2. Before Each Push

**Run one command:**
```bash
./scripts/validate-before-push.sh
```

This will:
- ✓ Verify environment (tool versions, Docker services)
- ✓ Detect what you changed
- ✓ Run appropriate validation tests
- ✓ Report results clearly

**Expected output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pre-Push CI Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ Validating Environment
  → Bun version 1.3.0... ✓
  → Node version 22.14.0... ✓
  → Just version 1.36.0... ✓
  → Docker... ✓
  → Redis (port 6379)... ✓
  → PostgreSQL (port 4433)... ✓

▶ Detecting Changes
  → Web app
  → API / Backend

▶ Running Validation Commands
  → Formatting code... ✓ [1s]
  → Linting... ✓ [45s]
  → Type checking... ✓ [30s]
  → Building... ✓ [25s]
  → Web checks... ✓ [180s]
  → API checks... ✓ [120s]

Total time: 6m 41s
✓ All validations passed!
✓ Safe to push to remote repository.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## What Changes Trigger What Tests

| Changed Area | Tests Run | Estimated Time |
|---|---|---|
| Web app (`apps/web/`) | `just format` → `just lint` → `just typecheck` → `just build` → `just check-web` | 12-15 min |
| API (`services/api/`, `packages/*/auth`) | `just format` → `just lint` → `just typecheck` → `just build` → `just check-api` | 10-12 min |
| Mobile (`apps/mobile/`) | `just format` → `just lint` → `just typecheck` → `just build` → mobile typecheck → mobile tests | 8-10 min |
| Database (`packages/db/`, migrations) | `just format` → `just lint` → `just typecheck` → `just build` → `just db-migrations-validate` | 5-8 min |
| Multiple areas | All above combined | 15-25 min |
| Generic (config, docs, etc.) | `just format` → `just lint` → `just typecheck` → `just build` | 5-8 min |

---

## Manual Validation (If Preferred)

If you prefer to run commands individually instead of using the script:

### Step 1: Verify Environment (5 min)

```bash
# Check environment
./scripts/check-ci-environment.sh

# If any checks fail, follow the suggestions above
```

### Step 2: Format & Lint (5 min)

```bash
just format              # Auto-fix code style
just lint                # Check style & patterns
just typecheck           # Check TypeScript types
```

### Step 3: Build & Test (15-20 min)

```bash
just build               # Build all packages

# Then run tests based on what you changed:
just check-web           # If you changed web
just check-api           # If you changed api
just db-migrations-validate  # If you changed database
```

### Step 4: Verify Results

- ✓ All commands exited with code 0
- ✓ No red error messages
- ✓ Summary shows "passed" or similar

---

## Environment Alignment Requirements

Your **local environment must match CI exactly** to prevent "passes locally, fails in CI" failures.

### Tool Versions (Required)

These exact versions are enforced by CI:

| Tool | Version | Check |
|---|---|---|
| Bun | 1.3.0 | `bun --version` |
| Node.js | 22.14.0 | `node --version` |
| Just | 1.36.0 | `just --version` |

**Why these versions matter:**
- Different versions may have incompatible API changes
- Build output may differ between versions
- Tests might pass locally but fail in CI (or vice versa)

**What about mobile?**
Mobile workflows use different pinned versions (Bun 1.3.10, Node 22.11.0). Set these when working on mobile:
```bash
asdf local bun 1.3.10     # For mobile work
asdf local nodejs 22.11.0 # For mobile work
```

### Docker Services (Required)

All these services must be running for tests to pass:

```bash
docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d
```

| Service | Port | Purpose | Health Check |
|---|---|---|---|
| Redis | 6379 | Cache, sessions | `redis-cli ping` |
| PostgreSQL (dev) | 5434 | Development database | `psql ... -c 'SELECT 1'` |
| PostgreSQL (test) | 4433 | Test database | `psql ... -c 'SELECT 1'` |
| Jaeger | 16686, 4317 | Distributed tracing | HTTP GET /  |

**Why they're needed:**
- API integration tests use real PostgreSQL
- Auth tests require database fixtures
- Performance tests measure real latencies
- CI uses identical Docker images

### Environment Variables (Required for Some Tests)

Create `infra/compose/.env`:

```bash
# Copy template
cp infra/compose/.env.example infra/compose/.env

# Required for auth and integration tests
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=hominem
POSTGRES_TEST_DB=hominem-test

COOKIE_SECRET_TEST=test-secret-value
AUTH_E2E_SECRET=test-otp-secret
DATABASE_URL=postgresql://postgres:postgres@localhost:4433/hominem-test?sslmode=disable
REDIS_URL=redis://localhost:6379

# Placeholders OK for local (actual values not needed)
GOOGLE_API_KEY=placeholder
OPENAI_API_KEY=placeholder
RESEND_API_KEY_TEST=placeholder
RESEND_FROM_EMAIL=test@example.com
```

---

## Troubleshooting

### Problem: "Command not found: just"

**Solution:**
```bash
# Install via asdf
asdf install just 1.36.0
asdf local just 1.36.0

# OR download directly
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash
```

### Problem: "Docker daemon is not running"

**Solution:**
- **macOS:** Open Docker Desktop app
- **Linux:** `sudo systemctl start docker`
- **Windows:** Start Docker Desktop

### Problem: "Redis/PostgreSQL not responding"

**Solution:**
```bash
# Check service status
docker compose ps

# Start services if stopped
docker compose -f infra/compose/base.yml -f infra/compose/dev.yml up -d

# View logs for errors
docker compose logs redis      # Redis logs
docker compose logs postgres   # PostgreSQL logs

# Restart services
docker compose restart
```

### Problem: "Port 6379 already in use"

**Solution:**
```bash
# Find what's using the port
lsof -i :6379

# Either stop that service or use different port
# Update infra/compose/dev.yml to use different ports
```

### Problem: "TypeScript errors locally but not in CI"

**This shouldn't happen!** But if it does:

1. **Verify tool versions match:** `bun --version`, `node --version`
2. **Verify TypeScript config:** Check `tsconfig.json` and `turbo.json`
3. **Clear cache:** `rm -rf .turbo node_modules .bun`
4. **Reinstall:** `just setup`

### Problem: "Tests pass locally but CI fails"

**Check:**
1. ✓ Tool versions match exactly
2. ✓ All Docker services running and healthy
3. ✓ Database has latest migrations: `just db-migrate`
4. ✓ Clear Turbo cache: `turbo prune --docker`
5. ✓ Reinstall dependencies: `just setup`

### Problem: "Script permission denied"

**Solution:**
```bash
chmod +x ./scripts/validate-before-push.sh
./scripts/validate-before-push.sh
```

---

## What Passes Locally vs CI

Your local environment should mirror CI exactly **except** for these acceptable differences:

| Area | Local | CI | Impact |
|---|---|---|---|
| OS | macOS, Linux, Windows | Ubuntu Linux | Minimal (no OS-specific code) |
| Architecture | x86, ARM | x86 | Minimal (no arch-specific code) |
| Secrets | Placeholder values | Real GitHub secrets | Skip email delivery, some API tests |
| Artifact storage | Not stored | GitHub artifact storage | None (no test output) |
| Cache | Local Turbo cache | GitHub Actions cache | Faster, same results |
| Third-party services | Mocked or disabled | Real services | Different test coverage |

**Key:** If a test requires real secrets or services, it's expected to behave differently locally vs CI.

---

## CI Workflows Reference

These are the workflows you're validating locally:

| Workflow | Files | Runs | Key Steps |
|---|---|---|---|
| **code-quality.yml** | All | Every push | lint, typecheck, build, test |
| **ci.yml** | Changes only | Main branch | Change detection, conditional jobs |
| **mobile-*.yml** | Mobile code | Mobile changes | Mobile-specific tests |
| **web-*.yml** | Web code | Web changes | Web-specific tests |

**View full workflow definitions:**
- `.github/workflows/code-quality.yml` - Full quality gates
- `.github/workflows/ci.yml` - Change detection and conditional jobs
- `.github/workflows/mobile-test.yml` - Mobile unit/render/contract tests
- `.github/workflows/web-test-e2e.yml` - Web E2E auth tests

---

## Advanced: Running Specific Tests

### Run Only Linting (Fast)
```bash
just lint
```

### Run Only Type Checking (Fast)
```bash
just typecheck
```

### Run Only Web Tests
```bash
just check-web
```

### Run Only API Tests
```bash
just check-api
```

### Run Only Mobile Tests
```bash
cd apps/mobile
bun run test:unit
bun run test:render
```

### Run Only Database Validation
```bash
just db-migrations-validate
```

### Run E2E Tests (Web Auth)
```bash
just web-install-playwright
just web-test-e2e-local
```

---

## Optional: Git Pre-Push Hook

To automatically validate before pushing to remote, set up a git hook:

```bash
# Create pre-push hook
mkdir -p .git/hooks
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
./scripts/validate-before-push.sh
if [ $? -ne 0 ]; then
  echo "❌ Validation failed. Fix issues and retry."
  echo "   Or force push with: git push --no-verify"
  exit 1
fi
EOF

# Make it executable
chmod +x .git/hooks/pre-push
```

Now pushing will automatically validate:
```bash
git push origin feature-branch
# validation runs automatically
# pushes only if all checks pass
```

To skip validation (not recommended):
```bash
git push --no-verify
```

---

## Need Help?

- **Questions about validation?** Check the Troubleshooting section above
- **Issues with tools?** See Quick Start installation steps
- **Docker problems?** Try `docker compose restart` or `docker compose down && docker compose up -d`
- **Still stuck?** Review the CI workflow files (`.github/workflows/`) to understand what they check

---

## Summary

1. **Setup once:** Install tools, start Docker, create `.env`
2. **Before each push:** Run `./scripts/validate-before-push.sh`
3. **Fix any issues** shown by the script
4. **Push when all checks pass**
5. **CI will pass** (if environment was truly aligned)

This saves GitHub Actions credits by catching failures locally instead of in CI.
