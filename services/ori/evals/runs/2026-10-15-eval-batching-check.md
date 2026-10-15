# Eval Batching Performance Check

- **Date:** 2026-10-15
- **Candidate model:** `openai/gpt-5-mini`
- **Judge model:** `openai/gpt-4.1-mini`
- **Change measured:** shared JSON eval batches increased from 3 to 6 cases.
- **Cost:** the targeted command output did not provide an aggregate cost total. Per-call usage is emitted, but this run's total was not retained. The full-suite cost record and its MCP-router coverage caveat are in [`2026-10-15-all-evals.md`](2026-10-15-all-evals.md).

## Timings

| Suite                            | Batch 3 | Batch 6 |     Change | Batch 6 result          |
| -------------------------------- | ------: | ------: | ---------: | ----------------------- |
| Offer extraction (32 cases)      | 187.38s | 117.70s | 37% faster | Failed judge assertions |
| Time-block regression (28 cases) | 115.03s |  62.77s | 45% faster | Passed                  |

Batch-3 values came from the full eval run; batch-6 values came from focused reruns. Model outputs and judge verdicts vary between runs, so timings are directional rather than a controlled benchmark. The batch-6 setting increased parallel cases and did not reduce the number of candidate calls.

## Related MCP Measurements

After batching the previously sequential eval files, focused runs completed in 34s for chat baseline, 32s for finance review, and 75s for MCP planning. A later full run measured 27s, 22s, and 87s respectively. Finance review passed; chat baseline and planning failed their existing quality assertions. The initial all-evals run and recorded model usage are in [`2026-10-15-all-evals.md`](2026-10-15-all-evals.md).
