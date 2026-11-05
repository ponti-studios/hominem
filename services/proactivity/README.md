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

# Start the live demo server (real model calls from the page).
pnpm --filter @hominem/proactivity demo

# Generate a static snapshot of the showcase.
pnpm --filter @hominem/proactivity demo:report
```

The live demo serves `http://127.0.0.1:4177`. Pick a scenario, edit the
current state, and hit Evaluate; the page calls the model and renders the
decision, evidence, email preview, and latency. `demo:report` writes
`services/proactivity/demo/proactivity-demo.html` for offline sharing.

The live slot builds its prompt and structured-output schema in
`src/slot.ts`, and resolves the model's reasoning profile through
`@hominem/ai/model-capabilities` so provider constraints (for example, GPT-5
mini requiring `minimal` reasoning) stay in one place.

