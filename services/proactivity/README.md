# Proactivity engine

Goal-centered evaluation and delivery planning for Hominem. The engine owns the
trigger, context, decision, evaluation-run, and delivery-intent contracts; the
API, scheduler, and clients are deliberately not wired yet.

## Tests

Run the engine and harness tests with:

```sh
pnpm --filter @hominem/proactivity test
```

## Evaluations

`src/evals/cases.ts` holds real-world scenarios with expected decisions,
required evidence, forbidden language, and delivery expectations. The harness
checks decision kind, evidence grounding, privacy terms, length limits, and
delivery side effects.

```sh
# Deterministic harness run; no model calls.
pnpm --filter @hominem/proactivity eval -- --offline

# Live run against the shared OpenRouter client.
pnpm --filter @hominem/proactivity eval -- --live --model openai/gpt-5-mini

# One or more cases.
pnpm --filter @hominem/proactivity eval -- --live --case grocery-overspend

# Generate the stakeholder showcase from live results.
pnpm --filter @hominem/proactivity demo
```

The demo writes `services/proactivity/demo/proactivity-demo.html`: a
self-contained, filterable page with the before/after evidence, the decision,
the email it would send, and the cases where it deliberately stays quiet.

The live slot builds its prompt and structured-output schema in
`src/slot.ts`, and resolves the model's reasoning profile through
`@hominem/ai/model-capabilities` so provider constraints (for example, GPT-5
mini requiring `minimal` reasoning) stay in one place.

