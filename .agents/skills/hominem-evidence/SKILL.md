---
name: hominem-evidence
description: Decide what evidence proves a change is complete, and produce the completion report before reporting work done. Use before ending any turn that changed code, config, docs, or infrastructure in this repo — this is the mandatory validation standard referenced by AGENTS.md.
---

# Hominem evidence standard

A change is complete only when its validation proves the behavior or artifact
that changed, in the environment where it matters. Choose evidence for the
risk of the change, not from habit. Type checks, linting, builds, and
unrelated tests are supporting evidence — they do not by themselves prove a
user interaction, visual layout, external side effect, or deployment outcome.

## Choose evidence by change

| Change | Minimum evidence |
| --- | --- |
| Documentation | Check whitespace, links changed by the edit, headings, and the rendered or read-through result |
| Pure computation or contract | Focused test covering the changed input and output |
| Refactor | Focused behavior tests, then the type check or build needed to prove the public boundary is unchanged |
| API or RPC | Targeted integration test asserting the request/response contract |
| User-visible or interactive behavior | Test the states and transitions named in the acceptance criteria on the target device or in the target browser |
| Constrained composition | Check the complete layout at the smallest supported viewport, device, or container named by the owning app or feature documentation |
| Database change | Apply the migration in the supported environment and verify the resulting schema and affected behavior |
| External write | Check the resulting external state and confirm the target, identity, and write outcome |
| Deployment | Verify the resolved target and the final remote deployment state |
| Framework or library capability | Prove the exact capability with a small test before building on it |

This table is a floor, not a substitute for more evidence when the risk
demands it.

## Interactive behavior

A control that renders is not validated until its action and resulting state
are observed. Validate every state named in the acceptance criteria: entry,
active, focused, loading, cancellation, failure, return, recovery. If an
app-owned control or outcome can't be selected or observed reliably, resolve
that testability gap or report it — don't replace it with a fuzzy assertion.

## Constrained layouts

Before composing controls into a constrained surface, prove the complete
composition fits at the smallest supported viewport/device/container named by
the owning app or feature documentation. If the chosen primitive can't meet
the approved behavior within those constraints, stop and report the
limitation — don't improvise a different product behavior.

## Handling a failed or unavailable check

- **Failed**: fix it or report the failure — don't call the change complete.
- **Skipped or unavailable**: the behavior remains unverified — don't call the
  change complete.
- **Ambiguous, stale-build, or non-targeted**: not evidence for the changed
  behavior — re-run a targeted check.
- **Not applicable**: state why the category doesn't apply.

Never call work complete, update acceptance tests as though they passed, or
claim a result based on a check that didn't exercise the changed behavior.

For ordered browser matrices, preserve the distinction between a passed test,
an explicit harness skip, and an unrun dependent scenario. Keep the screenshot,
DOM snapshot, console/network capture, and durable API correlation with the
scenario artifact. If a browser test fails before exercising the intended
state (for example, an SSR boot failure), fix or classify that runtime problem
and rerun the scenario before treating its assertion as evidence.

## Completion report

Use this structure when reporting completed work:

```markdown
## Validation

- Scope:
- Command or flow:
- Environment:
- Observed result:
- Artifacts:
- Unverified:
```

Name the evidence, its scope, and anything that remains unverified. Do not
replace evidence with an assumption.
