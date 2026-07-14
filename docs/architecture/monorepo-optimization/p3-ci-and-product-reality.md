# P3 CI And Product Reality

Status: proposed
Goal: make CI, deploy workflows, docs, and command scopes reflect the actual product portfolio

## Summary

P3 is about portfolio truth. The repo now has a cleaner command interface, but the product story is inconsistent. Some docs imply only API and Omiro are active. Career has an operating production deployment, and `just` treats Finance as a first-class scope.

The architecture should make it obvious which products are active, which are experimental, and which are archived.

## Findings

### Product Status Is Unclear

The root README says the active surface is API and Omiro, but the command system and workflows include Career and Finance.

Evidence:

- [README.md](../../../README.md)
- [scripts/command](../../../scripts/command)
- [.github/workflows/deploy-career.yml](../../../.github/workflows/deploy-career.yml)
- [apps/finance/railway.json](../../../apps/finance/railway.json)

Required decision:

- Is Career active, experimental, or archived?
- Is Finance active, experimental, or archived?
- Is Omiro the only shipped app?
- Is API the only backend deployable?

Once answered, align:

- README
- package docs
- `just` scopes
- GitHub workflows
- Railway configs
- validation expectations

The deployment repair establishes one immediate fact: Career is currently maintained
enough to warrant a production workflow and validation. A future decision may retire
it deliberately, but the README cannot describe it as absent while its production
service remains under active operational ownership.

### Deploy Targets Need Explicit Ownership

The Railway project currently contains services associated with more than one repository.
That made it possible for a Hominem GitHub secret to select the Labyrinth service from the
separate Labs repository. The resulting error named a missing Labyrinth Dockerfile, even
though the Hominem archive was the actual input.

There is a second ownership boundary inside Railway: a service may be deployed by a
GitHub workflow, a linked Railway repository source, or both. Both is not redundancy;
it creates competing revisions and configuration paths. The worker demonstrated this
when the GitHub workflow deployment succeeded but the linked-source deployment later
failed against a stale worker config path.

Required shape:

- Assign one deploy authority per service. Hominem production services use GitHub
  Actions; their Railway linked-source auto-deploy must remain disconnected.
- Maintain a checked-in deployment-target registry. Each entry records the owning
  repository, logical service name, Railway service identity, config path, trigger
  workflow, and deployment authority.
- Keep Railway service IDs in GitHub secrets, but validate their resolved names against
  the registry before upload. This protects against a correctly formatted but wrong ID.
- Prefer separate Railway projects for independently operated repositories. If services
  intentionally share a project, the registry and workflow checks are mandatory.
- Treat a deploy job as successful only after the target Railway deployment reaches a
  successful terminal state. Archive upload success is an intermediate event.

### Finance Is First-Class Locally But Missing CI

`just check finance` exists and Finance has package scripts, but there is no `validate-finance.yml`.

Evidence:

- [apps/finance/package.json](../../../apps/finance/package.json)
- [scripts/command](../../../scripts/command)
- [.github/workflows](../../../.github/workflows)

Required shape:

- If Finance is active, add a workflow that runs `just check finance`.
- If Finance is not active, remove it from canonical scopes or document it as experimental.

### Check Semantics Are Too Uniform

`just check <scope>` runs the same broad sequence for every scope:

- format check
- lint
- typecheck
- build
- test

That is simple, but each product has different release confidence needs.

Examples:

- Mobile likely needs format, lint, typecheck, and tests; app-store build is a separate release action.
- API needs migrations, build, and tests.
- DB needs migration validation and codegen drift checks.
- Pure packages may not have meaningful build or test commands.

Required shape:

- Keep the grammar stable.
- Let implementation be scope-aware.
- Avoid no-op package scripts unless they are an explicit contract choice.

### Turbo Still Carries Virtual Tasks

Turbo dry-runs include packages with `<NONEXISTENT>` task commands when those packages do not implement the task. That is not always a failure, but it makes graphs harder to reason about.

Required shape:

- Define a tiny workspace script contract.
- Decide which scripts every workspace must implement.
- Let missing tasks be intentional, not accidental noise.

### CI Path Filters Are Uneven

Some validation workflows have path filters; API is broader. Packages changes trigger multiple workflows, but the coverage is not clearly derived from dependency ownership.

Evidence:

- [.github/workflows/validate-api.yml](../../../.github/workflows/validate-api.yml)
- [.github/workflows/validate-career.yml](../../../.github/workflows/validate-career.yml)
- [.github/workflows/validate-mobile.yml](../../../.github/workflows/validate-mobile.yml)
- [.github/workflows/validate-db.yml](../../../.github/workflows/validate-db.yml)

Required shape:

- Workflows should map to products and shared infrastructure.
- Shared package changes should trigger the products that consume them.
- Finance needs a policy.

### Docs Still Contain Old Command Paths

Some package docs still mention package-level pnpm/Bun commands instead of the canonical `just` interface.

Evidence:

- [services/api/README.md](../../../services/api/README.md)
- [README.md](../../../README.md)

Required shape:

- Contributor docs should show `just` first.
- Package scripts should be described as implementation details, not developer entrypoints.
- Dangerous direct commands should be avoided or clearly labeled.

## Product Classification Options

### Option A: API And Omiro Only

Keep only API and Omiro as active products.

Actions:

- Retire Career's deploy workflow and Railway service as one intentional archival change.
- Remove Finance first-class `just` scope.
- Move Career/Finance docs to experimental/archived language.
- Keep package checks only where they support API/Omiro.

### Option B: API, Omiro, Career, And Finance Are Active

Treat all four products as first-class.

Actions:

- Add Finance validation workflow.
- Align Career and Finance deployment runtime with repo standards.
- Update root README to list all active products.
- Keep all scopes in `just`.

### Option C: Tiered Products

Use explicit tiers:

- Active: API, Omiro
- Maintained: Career
- Experimental: Finance

Actions:

- Keep `just` scopes for maintained/experimental work.
- CI active products on every relevant PR.
- CI maintained/experimental products on path changes only.
- Deploy only active/maintained products.

Recommended initial choice: Option C unless the portfolio decision is already clear. It preserves work without pretending every app has the same release burden.

## Implementation Checklist

- [ ] Decide product classification.
- [ ] Align README with that classification.
- [ ] Add or remove Finance CI based on classification.
- [ ] Align Career deploy workflow with classification.
- [ ] Record every production deployment target and its single deployment authority.
- [ ] Disconnect linked Railway sources for GitHub-managed services and prevent their
      reintroduction without an ownership decision.
- [ ] Make reusable Railway deployment workflows verify target identity and final remote
      deployment success.
- [ ] Make `just check` scope-aware where release confidence differs.
- [ ] Define workspace script contract.
- [ ] Clean old docs that recommend direct package commands.
- [ ] Update workflow path filters to match product ownership.

## Validation

```bash
just --summary
just check api
just check career
just check finance
just check mobile
pnpm exec turbo run check --dry=json
```

For workflow changes, validate with GitHub Actions dry review where possible and confirm each active product has one canonical validation command.
