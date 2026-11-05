# Proactivity engine

Goal-centered evaluation and delivery planning for Hominem. The engine owns the
trigger, context, decision, evaluation-run, and delivery-intent contracts; the
API, scheduler, and production clients are deliberately not wired yet. See
[the proactivity PRD](../../docs/proactivity-engine-prd.md) for scope and open
product decisions.

New to the engine? [The one-week explainer](../../docs/proactivity-engine-explainer.html)
walks a single goal through the machine across four days, showing the real
records each part sends and receives.

## Tests

```sh
pnpm --filter @hominem/proactivity test
```

The suite covers the engine, the model slot, the delivery policy, the studio
world invariants, and the evaluation harness.

## Evaluations

`src/evals/cases.ts` holds 26 real-world scenarios with expected decisions,
required evidence, forbidden language, and delivery expectations. The harness
checks decision kind, evidence grounding, privacy terms, length limits, and
delivery side effects, and records the goal, trigger, and snapshot identifiers
for every case.

Cases are split into two suites. Tune against `regression` and validate with
`holdout`, so prompt and threshold changes cannot be shaped by the whole
benchmark:

| Suite        | Cases | Use                                             |
| ------------ | ----- | ----------------------------------------------- |
| `regression` | 18    | Day-to-day tuning of the slot and harness.      |
| `holdout`    | 8     | Review runs; not used to tune prompts.          |

```sh
# Deterministic harness run; no model calls.
pnpm --filter @hominem/proactivity eval -- --offline

# One suite.
pnpm --filter @hominem/proactivity eval -- --offline --suite holdout

# Live run against the shared OpenRouter client.
pnpm --filter @hominem/proactivity eval -- --live --suite regression

# One or more cases.
pnpm --filter @hominem/proactivity eval -- --live --case grocery-overspend
```

The live suite needs `OPENROUTER_API_KEY`. Run `--suite regression` live while
tuning; run `--suite holdout` live at review time and treat a failure as a
finding about the engine rather than retuning prompts against it.

Deterministic preflights run before the model. A goal with no current evidence,
a blocking data-quality flag, or evidence older than seven days defers without a
model call, and a recorded refund, credit, correction, or adjustment resolves to
quiet.

## Studio

`studio/` is a local product surface for seeing the engine decide against a
synthetic week. It is not a production client and is not connected to the API,
scheduler, or real data.

```sh
# Live studio; requires OPENROUTER_API_KEY.
pnpm --filter @hominem/proactivity demo
```

Open `http://127.0.0.1:4177`. Pick a day, run its checks, open any decision to
see the captured evidence, the email it would send, and the model run. The
inject panel adds a new fact and re-evaluates the affected goals live. Runs are
journalled in SQLite under `.data/`; **Reset the week** clears them.

Every affected goal is one live model call. Deterministic safety preflights do
not call the model and are labelled in the UI.

```sh
# Production build of the studio, served by the Node process.
pnpm --filter @hominem/proactivity studio:build
pnpm --filter @hominem/proactivity studio:serve
```

The live slot builds its prompt and structured-output schema in `src/slot.ts`,
and resolves the model's reasoning profile through
`@hominem/ai/model-capabilities` so provider constraints (for example, GPT-5
mini requiring `minimal` reasoning) stay in one place. User-facing copy is
sanitized before validation: evidence ids, field names, and ISO dates never
reach a person, and next steps that recommend irreversible actions are
rejected and retried.
