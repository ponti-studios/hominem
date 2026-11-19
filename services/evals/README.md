# Evals

Evals for Hominem's assistant behavior, extraction, and MCP tool use. Runs on
[promptfoo](https://www.promptfoo.dev) (Node API), wrapped by a small runner in `runner/` that
adds trials, baselines, and a regression gate.

## Quick start

```bash
just evals list        # suites, tiers, case counts, hashes (free)
just evals check       # validate every suite + baseline, no model calls (this is what CI runs)
just evals run         # run everything live, gate against baselines
just evals run --suite voice-cleanup --trials 3
just evals baseline    # promote the latest full run to baselines/ (review the diff!)
just evals calibrate   # score the judge against human labels
```

Without `just`: `pnpm --filter @hominem/evals eval <command>`. Live runs need
`OPENROUTER_API_KEY`; locally, `just evals run` sources `services/api/.env` (or point
`EVALS_ENV_FILE` at one).

Each run writes `runs/<id>/results.json` + `report.md` and `runs/latest.json` (gitignored). In
CI the report also lands in the job summary.

Exit codes: `0` ok, `1` gate failed (regression), `2` infrastructure errors.

## How it's built

- **Suites** are `evals/**/*.suite.ts`, each `export default await defineTextSuite(...)` or
  `defineMcpSuite(...)` (`evals/lib/suite.ts`). Datasets (`*.json`) and system prompts sit beside them.
- **Tiers**: `regression` (must not get worse, tolerance 0), `capability` (tolerance 0.1),
  `holdout` (release gate, tolerance 0.05, don't tune against it).
- **Deterministic graders first**: JSON schema, trajectory, and exact-field checks. In agent
  (MCP) suites the trajectory and judge are one assertion, so a trajectory failure never pays for
  the judge. Text suites run their judge alongside the deterministic checks (promptfoo runs
  assertions concurrently).
- **MCP suites** run a real tool-calling loop against fixtures (`evals/providers/mcp-agent.ts`)
  and grade the tool trace (`mcp-trace.ts`), then the answer (`mcp-judge.ts`).
- **Trials**: `--trials k` repeats every case. Reports show pass@1 (mean pass rate) and pass^k
  (case passed every trial), because a flaky pass isn't a pass.
- **Judge**: `EVALS_JUDGE_MODEL`, default `openai/gpt-5-mini`, threshold 0.7. The default is the
  same OpenAI family as the chat target (`openai/gpt-6-luna`), which the rule "a different model
  family from the target" disallows. Set `EVALS_JUDGE_MODEL` to another family for release-grade runs. `calibrate` grades the judge against
  `calibration/judge-labels.json`, reports agreement, Cohen's kappa, a 95% Wilson interval, and
  per-suite confusion counts. Each suite must reach 85% observed agreement and a 95% Wilson lower
  bound of at least 85%, with zero false passes. The labels are curated screening examples, so
  even a passing interval does not establish generalization; add diverse human-reviewed cases for
  each rubric before relying on the judge as a release signal.
- **Tracked every run**: cost, tokens (target + judge), p50/p95 latency, dataset/prompt/grader hashes, models.
- **Ledger**: `ledger.csv` (committed) has one row per suite run: git sha, pass rate, pass^k, cost, tokens, latency, models. It is rebuilt after every run; `just evals ledger` rebuilds it by hand and prints the recent runs.

## Baselines and the gate

`baselines/<suite>.json` holds the last accepted run. A run is only compared when dataset hash,
prompt hash, grader hash (rubrics, schemas, assertions, scoring code), target model, and judge model all match and the run wasn't `--limit`ed; otherwise
the gate is skipped and the report says why. Cases that already failed in the baseline are
"known failures" and don't block, fixes are called out, and a pass that turns into a fail blocks
(per-tier tolerance for capability/holdout).

Changed a dataset, prompt, or model on purpose? Run the full suite, read the report, then
`just evals baseline` and commit the diff.

## Adding things

- **Case**: add it to the suite's dataset with a stable unique id and a category. `eval:check` /
  `pnpm test` catch duplicates and missing assertions. Production failures go to `regression`, never to `holdout`.
- **Suite**: new `<name>.suite.ts` beside its data; names must be unique. Run it, then baseline.
- **Env**: `EVALS_TARGET_MODEL` (default `openai/gpt-5-mini`), `EVALS_JUDGE_MODEL`, `EVALS_ENV_FILE`.

## CI

`.github/workflows/evals.yml`: PRs touching evals, API tools, shared packages, or the lockfile run
`eval:check`, unit tests and typecheck (free, deterministic). The live job is manual
(`workflow_dispatch`) because it costs money.

`evals/lib/mcp-tool-catalog.generated.json` is the generated model-facing tool catalog from the API
registry. `eval:check` compares it with the current API definitions; after an intentional tool
change, review and update it with `pnpm --filter @hominem/evals eval:catalog:update`. Eval domain
membership remains explicitly curated in `mcp-tool-catalog.ts`. Catalog content contributes to the
grader hash, so a catalog update requires a reviewed live run before promoting new baselines.

## Caveats

- The chat-assistant and time-block prompt snapshots mirror production prompts; API tests fail if they drift.
