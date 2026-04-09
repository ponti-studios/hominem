## Summary

-

## Linear

- Ticket:
- Parent / project:

## Stack Context

- Base branch:
- Part of stack:

## Pre-Push Validation ✓

**Before pushing, run the comprehensive validation script:**
```bash
./scripts/validate-before-push.sh
```

This validates that CI will pass (environment alignment + tests). See [LOCAL_CI_VALIDATION.md](../LOCAL_CI_VALIDATION.md) for setup.

**Or manually validate with:**
- [ ] `./scripts/check-ci-environment.sh` (verify environment parity)
- [ ] `just format` (auto-fix formatting)
- [ ] `just lint` (code style)
- [ ] `just typecheck` (TypeScript)
- [ ] `just build` (compilation)
- [ ] Targeted checks: `just check-web` / `just check-api` / etc.

## Risks

-

## Follow-Ups

-

## Merge Checklist

- [ ] Scope is focused and reviewable
- [ ] No temporary debug code or dead code left behind
- [ ] Docs reflect the shipped behavior
- [ ] New config or environment requirements are called out
