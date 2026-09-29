# Ori evaluations

This service is Hominem's single evaluation harness, covering the assistant,
extraction, and MCP tool-selection suites. It replaced the earlier DeepEval
service, which has been removed.

The datasets under `data/` are versioned snapshots. The chat-assistant prompt is
a snapshot of `services/api/src/rpc/prompts.ts`; the API parity test makes drift
fail loudly. Keep regression and holdout fixtures separate, and add confirmed
production failures to regression data without moving holdout cases.

Run the discovery check without spending model credits:

```bash
pnpm --filter @hominem/ori eval:list
```

Run one suite with the incumbent target model:

```bash
pnpm --filter @hominem/ori eval:time-block-regression
```

Run all suites:

```bash
pnpm --filter @hominem/ori eval:all
```

Set `ORI_TARGET_MODEL` to compare another target and `ORI_JUDGE_MODEL` to
override the pinned judge. They default to `openai/gpt-5-mini` and the low-cost
GPT-OSS judge `openai/gpt-oss-20b`, respectively.

Run the comparison through OpenRouter:

```bash
pnpm --filter @hominem/ori eval:chat-assistant
```

The chat-baseline suite uses the same tool-free everyday prompts without
requiring exact judge agreement. It records the OpenRouter usage payload,
served model, request latency, and end-to-end latency on the Ori runtime
events. Run it through the public recipe when comparing model cost and speed:

```bash
just evals chat-baseline
```

Read this baseline alongside the hard MCP suite: it measures ordinary response
UX, while MCP measures planning and tool safety.

Use the pilot command before a full run to measure expected spend. Eval runs
make real model calls and can spend credits:

```bash
pnpm --filter @hominem/ori eval:pilot
```

The MCP suite uses a dedicated Ori harness that preserves the five Hominem
tool definitions, simulated results, multi-turn limit, tool ordering, and
completion checks.
