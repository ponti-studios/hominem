# Ori evaluations

Ori is Hominem's evaluation harness for assistant behavior, extraction, and MCP.

Each eval suite is a directory under `evals/`. Its `*.eval.ts` entry point
lives beside the cases, prompt snapshots, and fixtures it uses. Shared runner
code lives in `evals/lib/`. MCP suites are organized by what they evaluate:
agent behavior, domain answers, or protocol behavior.

The chat-assistant and time-block prompt snapshots mirror production prompts;
API tests fail if those snapshots drift. Keep time-block regression and holdout
cases separate. Add confirmed production failures to regression cases without
moving holdout cases.

List discoverable suites without spending model credits:

```bash
pnpm --filter @hominem/ori eval:list
```

Run one suite:

```bash
pnpm --filter @hominem/ori eval:time-block-regression
pnpm --filter @hominem/ori eval:mcp-tool-routing
pnpm --filter @hominem/ori eval:mcp-workflow-planning
pnpm --filter @hominem/ori eval:mcp-monthly-review
```

Run every suite:

```bash
pnpm --filter @hominem/ori eval:all
```

Eval runs make real model calls and can spend credits. Set `ORI_TARGET_MODEL`
to compare another target and `ORI_JUDGE_MODEL` to override the pinned judge.
They default to `openai/gpt-5-mini` and `openai/gpt-oss-20b`, respectively.
Use `just evals chat-baseline` to compare ordinary response quality, usage,
request latency, and end-to-end latency without exact judge agreement.
