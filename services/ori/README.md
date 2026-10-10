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

The default voice-task run gates only the production prompt. Compare the older
prompt candidates with:

```bash
pnpm --filter @hominem/ori eval:voice-task-extraction-variants
```

Set `ORI_TARGET_MODEL` to compare another target and `ORI_JUDGE_MODEL` to
override the pinned judge. They default to `openai/gpt-5-mini` and the low-cost
GPT-OSS judge `openai/gpt-oss-20b`, respectively.

`just evals costs` runs the suites once each and records target/judge dollars by
suite. It also saves each raw suite transcript, separates Bun test verdicts
from Ori-graded run correctness, and records ungraded (`outcome?`) runs, which
must not be treated as either correct or incorrect. Custom MCP and chat
harnesses accumulate OpenRouter usage across router and agent turns into the
run’s terminal `usage`, while default-agent suites get costs directly from Ori.

The caller retries a failed case only for an explicitly retryable provider
error, and only once. A suite `fail` can therefore mean:

- the provider/runtime died before any graded answer,
- a candidate or judge answer missed a correctness criterion, or
- a test-level matcher such as `expect(score.passed)` failed.

Use the full output or `--report` artifact, not the final pass/fail, to
distinguish those categories.

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

The MCP suites use a dedicated planning-only harness with a fixed set of
simulated tools, multi-turn limits, tool ordering, and completion checks. They
do not exercise the live MCP registry, schemas, ownership scoping, or
confirmation runtime; use the API test suites for those integration checks.
