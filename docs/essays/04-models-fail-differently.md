---
title: Models Fail Differently
summary: Model choice for agents is a reliability, cost, latency, and compatibility decision.
type: reference
status: draft
owner: hackefeller
tags: [agents, models, evaluation, reliability]
related: [../chat.testing.md]
updated: 2026-09-26
---

There is no single best tool-calling model. There are models that fail in different ways under a particular tool contract, provider, prompt, and fixture set.

Our direct raw-tool hard-suite runs produced this snapshot:

| Model             | Hard-suite result | Aggregate cost | Aggregate latency |
| ----------------- | ----------------: | -------------: | ----------------: |
| GPT-4o mini       |              7/10 |       $0.00086 |             27.0s |
| GPT-4.1           |              5/10 |       $0.01239 |             29.7s |
| Muse Spark 1.3    |              3/10 |       $0.03165 |            102.1s |
| Claude Sonnet 4.5 |              5/10 |       $0.05949 |             75.7s |
| GPT-5 mini        |              5/10 |       $0.01340 |            113.7s |

These are fixture-specific engineering measurements, not a general leaderboard. They came from the direct OpenRouter harness and current capability-first benchmark. They expose tradeoffs; they are not universal truths.

## A score hides the failure shape

Two models can both score 5/10 while needing different fixes. One may choose irrelevant tools but preserve every ID. Another may choose the right tools but stop at confirmation because the harness never supplied approval.

The model profile belongs in the system rather than scattered through routing branches:

```ts
export type ModelCapabilityProfile = {
  structuredPlanning: boolean;
  reasoning: ReasoningConfig;
};

export function getModelCapabilityProfile(model: string) {
  if (model.startsWith('meta/muse-spark-1.3')) {
    return { structuredPlanning: false, reasoning: undefined };
  }
  return { structuredPlanning: true, reasoning: { effort: 'none' } };
}
```

Muse Spark’s compatibility behavior is isolated in [`model-capabilities.ts`](../../packages/ai/src/model-capabilities.ts). The benchmark can therefore distinguish weak planning from provider rejection of structured-output or reasoning controls.

## Measure product dimensions

```ts
type ModelRun = {
  toolSelectionAccuracy: number;
  argumentAccuracy: number;
  dependencyAccuracy: number;
  confirmationCompliance: number;
  groundedAnswerRate: number;
  providerErrorRate: number;
  unauthorizedCallRate: number;
  latencyMs: number;
  totalTokens: number;
  costUsd: number | null;
};
```

A low-cost model with strong dependency accuracy may be right for personal finance lookup. A slower model with better ambiguity handling may be worth reserving for cross-domain planning. A model that cannot emit the requested structured plan should be isolated behind a compatibility profile, not compensated for with provider-name checks throughout the router.

## Provider behavior is part of the system

The model name is not the complete runtime. Provider defaults, supported schemas, reasoning controls, serialization, timeouts, and retries affect the observed result.

```json
{
  "model": "meta/muse-spark-1.3",
  "provider": "openrouter",
  "structuredPlanning": false,
  "toolSchemaVersion": "capability-first-v2",
  "failureCategory": "provider-compatibility"
}
```

Without this metadata, a future engineer may rewrite the prompt to compensate for a transport incompatibility.

## Choose models by workload

The useful question is not “Which model wins?” It is “Which model meets the safety and quality threshold for this workload within its cost and latency budget?”

For a personal agent, the usual constraint order is no unauthorized writes, correct prerequisites, grounded answers, acceptable latency, then acceptable cost. The ordering can change by surface, but it must be explicit.

```ts
const expectedValue =
  groundedAnswerRate * taskValue -
  costUsd -
  (providerErrorRate + unauthorizedCallRate) * safetyPenalty -
  latencyMs * latencyPenalty;
```

This is not a universal business formula. It is a reminder that model routing is product policy. The strongest model is not the one with the most elaborate answer; it is the one that meets the contract consistently enough for the runtime to keep the user in control.
