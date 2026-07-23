# V. Operations

The system is only real when a clean checkout, a deployment, and a production
failure all behave as deliberately as local development.

## Developer law

- `just` is the only repository-level command interface. Package scripts are
  Turbo primitives, not contributor instructions.
- Run the smallest relevant validation lane first: `just check api`,
  `just check mobile`, `just check career`, or `just check finance`.
- Source-first workspace exports are the local-development model. Production
  deployables build explicit artifacts; stale `build/` directories are never a
  second source of truth.
- One Node and pnpm line governs local development, CI, Docker, Railway, and
  EAS. Version drift is a defect.
- `@hominem/env` owns shared environment semantics. Framework prefixes adapt a
  variable for a runtime; they do not invent a second meaning.

## Evidence law

Completion is conditional on evidence of the exact changed behavior in its
real execution environment. Compilation, formatting, type checks, builds, and
broad test suites are supporting evidence only; they do not prove a visible
interaction, a layout, an external side effect, or a deployment result.

| Changed behavior | Required evidence |
| --- | --- |
| Pure computation or contract | Targeted test that asserts the changed input/output contract. |
| User-visible or interactive behavior | Target device/browser evidence for each changed state and transition. |
| Constrained composition | Verification at the smallest supported viewport, device, or container. |
| External write or deployment | Observation of the resulting external state and target identity. |
| Framework/library capability | Minimal working proof of the exact capability before feature work depends on it. |

- A stateful interaction is not verified by its idle render. Evidence covers
  entry, active/focused/loading state, cancellation or failure when applicable,
  and return or recovery.
- A failed, skipped, ambiguous, stale-build, or non-targeted validation leaves
  the change unverified. It is a blocker, not a warning to explain away.
- Before composing controls in a bounded surface, prove the complete
  composition fits. If the approved behavior does not fit in the chosen
  primitive, report the constraint and stop; do not silently change product
  behavior.
- Automation must have a deterministic selection and observation path for
  app-owned controls and outcomes. If it does not, resolve the testability gap
  or report it before completion.
- A completion report names the evidence, its scope, and any behavior that
  remains unverified. It never substitutes an assumed result for evidence.

## Deployment law

Every production service has one deployment authority. A GitHub-managed Railway
service must not also use Railway linked-source auto-deploy.

A deployment target is one versioned tuple:

```text
repository + logical service + immutable Railway service ID
+ checked-in configuration path + triggering workflow
```

Upload acceptance is not deployment success. Automation verifies the resolved
target identity and the final remote deployment state.

## Production safety

- `AUTH_TEST_OTP_ENABLED` is explicitly `false` in production.
- A successful OTP request does not prove mail delivery. Check deployment,
  `/api/status`, aggregate HTTP patterns, the production flag, and the provider
  path without logging OTPs or tokens.
- Do not casually rotate `BETTER_AUTH_SECRET`; it signs live session cookies.
- Production investigation uses aggregate session counts and expiry through an
  approved database tunnel. It never retrieves user records, session tokens,
  cookies, OTPs, or credentials.
- Logs redact secrets and avoid raw third-party URLs when a safer identifier
  exists.

## Bible law

The root README is the front door. This directory contains the five parts of
the Bible. Durable product, system, experience, voice, and operational laws
belong in their part; temporary execution belongs in the work tracker; local
implementation detail belongs in code.

When a change alters a durable law, update the relevant part in the same pull
request. Delete statements that are no longer true. The Bible explains the
system as it exists now.
