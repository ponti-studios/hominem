# Proactivity engine

Goal-centered evaluation and delivery planning for Hominem. The engine owns the
trigger, context, decision, evaluation-run, and delivery-intent contracts; the
API, scheduler, and production clients are deliberately not wired yet. See
[the proactivity PRD](../../docs/proactivity-engine-prd.md) for scope and open
product decisions.

## Tests

```sh
pnpm --filter @hominem/proactivity test
```

The suite covers the engine, the model slot, the delivery policy, the studio
world invariants, and the evaluation harness.

## Evaluations

`src/evals/cases.ts` holds 18 real-world scenarios with expected decisions,
required evidence, forbidden language, and delivery expectations. The harness
checks decision kind, evidence grounding, privacy terms, length limits, and
delivery side effects. The live suite currently passes 18/18 on
`openai/gpt-5-mini`.

```sh
# Deterministic harness run; no model calls.
pnpm --filter @hominem/proactivity eval -- --offline

# Live run against the shared OpenRouter client.
pnpm --filter @hominem/proactivity eval -- --live --model openai/gpt-5-mini

# One or more cases.
pnpm --filter @hominem/proactivity eval -- --live --case grocery-overspend
```

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
