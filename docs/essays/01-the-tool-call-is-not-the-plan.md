---
title: The Tool Call Is Not the Plan
summary: A reliable agent separates capability routing, exact tool planning, and guarded execution.
type: reference
status: draft
owner: hackefeller
tags: [agents, tool-calling, planning, typescript]
related: [../chat.capabilities.md, ../chat.generation.md]
updated: 2026-09-26
---

An agent that knows which domain matters still does not know what to do. “This is about travel and finance” is a routing decision, not an execution plan. The agent still has to choose the narrowest tools, preserve identifiers and dates, order dependent calls, and stop before an unsafe write.

## Four decisions hide inside “use a tool”

Production tool use separates capability selection, exact tool selection, argument construction, and authorization. A broad router answers only the first question. The Hominem chat surface represents the exact plan separately from the capability filter in [`chat-tool-adapter.ts`](../../services/api/src/mcp/chat-tool-adapter.ts).

```ts
const plan = {
  requiresLookup: true,
  steps: [
    { tool: 'trip_history', purpose: 'Find the Tokyo trip dates', dependsOn: [], arguments: {} },
    {
      tool: 'finance_recent_transactions',
      purpose: 'Find spending during those dates',
      dependsOn: ['trip_history'],
      arguments: {},
    },
  ],
};
```

The empty argument object is intentional. The finance call must receive normalized dates returned by `trip_history`, not dates invented by the model.

## Validate before execution

The plan schema lives in [`tool-planner.ts`](../../services/api/src/mcp/tool-planner.ts). Validation rejects unknown tools, duplicate steps, forward dependencies, cycles, invalid arguments, and writes that do not follow a read.

```ts
export const chatToolPlanSchema = z.object({
  requiresLookup: z.boolean(),
  steps: z.array(chatToolPlanStepSchema).max(20),
});

export const chatToolPlanStepSchema = z.object({
  tool: z.string().trim().min(1),
  purpose: z.string().trim().min(1).max(240),
  dependsOn: z.array(z.string().trim().min(1)).max(10),
  arguments: z.record(z.string(), z.unknown()).default({}),
});
```

Schema validation is necessary but not sufficient. A syntactically valid plan can still be semantically wrong, so the runtime validates every model-requested call again.

```ts
const step = plannedSteps.find((candidate) => candidate.tool === toolName);
if (!step) return `Tool ${toolName} is outside the validated tool plan`;

const missing = step.dependsOn.filter((dependency) => !completedPlannedTools.has(dependency));
if (missing.length > 0) {
  return `Tool ${toolName} is waiting for prerequisite tool(s): ${missing.join(', ')}`;
}
```

The model proposes. The runtime decides.

## Dependencies carry meaning

An array of tool names is too weak to explain why order matters. The important fact is that `trip_history` produces dates required by `finance_recent_transactions`.

```ts
type Dependency = {
  tool: string;
  reason: string;
  provides: readonly string[];
};

const financeDependency: Dependency = {
  tool: 'trip_history',
  reason: 'Transactions must use the selected trip range',
  provides: ['tripId', 'startDate', 'endDate'],
};
```

Independent reads should remain independent. If a user asks for travel history and a career profile, either read may happen first. Requiring one global sequence creates false failures and makes the model optimize for the test rather than the user’s outcome.

## A plan is not permission

A valid plan does not authorize deletion. The runtime still checks ownership, idempotency, cancellation, confirmation policy, and successful prerequisites.

```ts
if (definition && !definition.readOnly) {
  const hasCompletedRead = plannedSteps.some(
    (candidate) =>
      completedPlannedTools.has(candidate.tool) &&
      (runtime.getToolDefinition(candidate.tool)?.readOnly ?? false),
  );
  if (!hasCompletedRead) return 'Tool requires a preceding read-only lookup';
}
```

Planning makes intent inspectable; runtime guards make execution safe. Record both the proposed plan and the actual trace so a failure can be classified as wrong capability, wrong tool, lost identifier, broken ordering, or a safety violation.

The tool call is an event. The plan is the contract around the event.
