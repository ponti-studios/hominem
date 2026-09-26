---
title: What Your Eval Is Actually Measuring
summary: Agent evaluations need state, dependency-aware scoring, and trace-level failure categories.
type: reference
status: draft
owner: hackefeller
tags: [agents, evaluation, benchmarks, tool-calling]
related: [../chat.testing.md, ../chat.generation.md]
updated: 2026-09-26
---

An assertion can be deterministic and still measure the wrong behavior. Our first MCP benchmark compared the model’s tool-call array with one expected array. It treated harmless independent ordering as failure, counted confirmation requests as completed writes, and hid the difference between an invented identifier and a provider outage.

The fix was not a stronger prompt. It was a better measurement model.

## Exact sequences are usually the wrong oracle

If a user asks for travel history and career experience, these calls are both correct:

```ts
['trip_history', 'career_profile'];
['career_profile', 'trip_history'];
```

But this dependency is strict:

```ts
['trip_history', 'finance_recent_transactions']; // valid
['finance_recent_transactions', 'trip_history']; // invalid
```

The second call needs dates returned by the first. The evaluator should require that edge while leaving unrelated reads unordered.

## Score dimensions separately

The Ori scorer represents that distinction:

```ts
const score = scoreMcpTrace(trace, {
  requiredTools: ['trip_history', 'finance_recent_transactions'],
  dependencies: [['trip_history', 'finance_recent_transactions']],
  outputIncludes: ['Sushi Dai'],
});
```

The score separates missing tools, forbidden tools, violated dependencies, confirmation failures, missing grounded output, provider failures, and runtime failures. A missing tool is a selection problem. A wrong date is argument propagation. A call outside the plan is authorization. A timeout is not evidence that the model chose badly.

## Fixtures need real ambiguity

An ambiguous fixture with one Alex is not ambiguous. Stateful fixtures need duplicate names, no-match versus failed lookup, existing and missing collections, duplicate memories, stable entity IDs, and normalized dates.

```ts
type LookupResult<T> =
  | { status: 'found'; items: T[] }
  | { status: 'no_match'; items: [] }
  | { status: 'ambiguous'; items: T[] }
  | { status: 'failed'; error: string };
```

The benchmark in [`benchmark.v2.json`](../../services/ori/data/mcp-tool-selection/benchmark.v2.json) uses these distinctions for conditional writes and confirmation boundaries.

## Confirmation needs a conversation

A single-turn test cannot prove a two-turn protocol:

```text
user request → tool request → confirmation_required
→ assistant explains pending action → approval or rejection
→ resume or record no change
```

If the harness stops after the third step and marks the run complete, a model that correctly paused and a model that failed to understand the request can look identical. This is why stateful benchmarks such as [ToolSandbox](https://arxiv.org/abs/2408.04682) and [τ-bench](https://arxiv.org/abs/2406.12045) treat intermediate state as part of the task.

## Grade traces, not only prose

The trace should retain model, provider, prompt version, exposed tools, planned steps, actual calls, arguments, outputs, confirmation events, errors, tokens, cost, latency, retries, and final answer.

```json
{
  "model": "openai/gpt-4o-mini",
  "scenario": "trip-finance-date-chain",
  "plannedSteps": ["trip_history", "finance_recent_transactions"],
  "actualCalls": [
    { "tool": "trip_history", "arguments": {} },
    {
      "tool": "finance_recent_transactions",
      "arguments": {
        "from": "2025-04-10",
        "to": "2025-04-18"
      }
    }
  ],
  "dependencyChecks": { "trip_history -> finance_recent_transactions": true },
  "totalTokens": 644,
  "costUsd": 0.00011055
}
```

The [OpenAI agent-eval guidance](https://developers.openai.com/api/docs/guides/agent-evals) emphasizes traces and workflow-level grading. Its [grader guidance](https://developers.openai.com/api/docs/guides/graders) treats tool names and arguments as separate evidence, as does the [T-Eval](https://aclanthology.org/2024.acl-long.515.pdf) decomposition of tool selection, argument formulation, ordering, and interpretation.

## Repeat the hard suite

One successful run demonstrates possibility, not reliability. Run hard scenarios repeatedly against versioned fixtures with the model, provider, prompt, and benchmark version recorded. This also exposes evaluator bugs, such as internal outcomes marked `unknown` while a scenario assertion reports a concrete mismatch.

```text
instrument → classify → fixture → run → inspect trace → revise → repeat
```

The benchmark is not a gate at the end of development. It is the instrument panel for the agent.
