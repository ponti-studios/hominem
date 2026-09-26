---
title: The Personal Agent Is a Typed Capability System
summary: Personal agents become reliable when tools, state, authorization, and evidence share one contract.
type: architecture
status: draft
owner: hackefeller
tags: [agents, architecture, mcp, typed-systems]
related: [../architecture.md, ../chat.capabilities.md, ../chat.generation.md]
updated: 2026-09-26
---

The durable advantage of a personal agent is not a clever system prompt. It is a typed capability system that knows what data exists, how entities are identified, which actions are safe, and what evidence supports the answer.

Personal data makes weak contracts expensive. A name can match several people. A date can belong to a local timezone. A collection can already exist. A write can be harmless to repeat—or externally visible and impossible to undo.

## One registry, two surfaces

The in-app chat and external MCP surfaces should derive from the same capability definitions. Otherwise the model sees one description in chat, a different schema through MCP, and a third behavior at runtime.

```ts
interface CapabilityDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  readOnly: boolean;
  scopes: readonly string[];
  resultCap: number;
  requiresConfirmation?: boolean;
  idempotent?: boolean;
  guidance?: CapabilityGuidance;
}
```

The production definition is in [`capability.ts`](../../services/api/src/application/capability.ts). The important property is that the registry describes the boundary once and projects it outward.

## IDs beat names

Names are for humans; stable IDs are for execution.

```ts
type PersonLookup = {
  id: string;
  name: string;
  email: string | null;
};

type PersonTimelineInput = { personId: string };
```

The model may use “Alex” to search. It must use a returned `personId` to load a timeline, invite a collaborator, or remove a collection member. Multiple matches require clarification, not a guessed ID. The same rule applies to dates: “Tokyo trip” becomes a finance query only after a travel lookup returns normalized `startDate` and `endDate`.

## Outputs serve the next step

A tool output is an input contract for later decisions.

```ts
type Trip = {
  id: string;
  city: string;
  startDate: string;
  endDate: string;
};

type TripHistoryOutput = {
  trips: Trip[];
  count: number;
  truncated: boolean;
};
```

Stable identifiers, normalized dates, bounded results, and explicit truncation let the agent decide whether it has enough evidence. A response that says “Tokyo trip found” but omits its ID and range forces reconstruction from prose.

## Read-before-write is an invariant

A write should usually follow a read because the system needs a target and a duplicate check.

```ts
const writePolicy = {
  remember: { requiresPrior: ['search_memories'], duplicateSafe: true },
  invite_member: { requiresPrior: ['list_collections', 'people_lookup'] },
  career_application_delete: { requiresPrior: ['career_applications'] },
};
```

The runtime enforces this independently of the prompt. The prompt improves model behavior; the guard protects the user when the model behaves unexpectedly.

## Evidence belongs in the answer

A personal agent should distinguish tool facts from recommendations and inference.

```ts
type Evidence =
  | { kind: 'tool_fact'; tool: string; field: string; value: unknown }
  | { kind: 'inference'; basis: string }
  | { kind: 'recommendation'; reason: string };
```

That distinction makes answers auditable and lets evaluators reward grounded wording differences while rejecting invented fields.

## Observability turns behavior into data

```ts
type AgentTrace = {
  model: string;
  provider: string;
  promptVersion: string;
  exposedTools: string[];
  plannedSteps: string[];
  actualCalls: Array<{ tool: string; arguments: Record<string, unknown> }>;
  confirmationEvents: string[];
  errors: Array<{ category: string; message: string }>;
  tokens: { prompt: number; completion: number; total: number };
  costUsd: number | null;
  latencyMs: number;
  finalResponse: string;
};
```

The Ori harness records benchmark version, model, tool calls, usage, latency, and terminal state in [`mcp-harness.ts`](../../services/ori/evals/lib/mcp-harness.ts). The scorer evaluates that trace instead of guessing from the final sentence.

## The capability flywheel

```text
contract → plan → guard → trace → classify → fixture → evaluate → revise
```

When a model calls the wrong tool, improve boundaries or planning evidence. When it invents an ID, improve lookup outputs and runtime validation. When it stops at confirmation, inspect whether the harness supplied approval. When it times out, classify provider behavior before rewriting the prompt.

This is how a personal agent becomes more capable without becoming less safe. The model supplies flexible language understanding. The capability contract supplies stable semantics. The runtime supplies authority. The trace supplies evidence.
