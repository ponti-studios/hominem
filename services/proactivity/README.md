# Proactivity engine

This standalone Node package prototypes goal-centered evaluation and delivery
planning. It is not wired to the API, MCP server, or client applications.

Run the mocked engine tests with:

```sh
pnpm --filter @hominem/proactivity test
```

The ten synthetic goal scenarios drive the same engine contract with a scripted
evaluator slot. They validate orchestration, evidence boundaries, idempotency,
and delivery planning; they do not measure a language model's reasoning.
