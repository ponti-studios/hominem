---
title: Confirmation Is a Protocol, Not a Boolean
summary: Consequential agent actions need explicit pending, approval, rejection, and recovery states.
type: reference
status: draft
owner: hackefeller
tags: [agents, safety, tool-calling, confirmation]
related: [../chat.generation.md, ../decisions/chat.runtime.md]
updated: 2026-09-26
---

`requiresConfirmation: true` is useful metadata. It is not a safety protocol. A boolean cannot represent whether an action has been previewed, approved, rejected, or blocked while a dependent write is pending.

## Model the boundary as state

```ts
type ConfirmationState =
  | { status: 'ready' }
  | { status: 'pending'; tool: string; input: Record<string, unknown> }
  | { status: 'approved'; tool: string; input: Record<string, unknown> }
  | { status: 'rejected'; tool: string; input: Record<string, unknown> };
```

The transition into `pending` must not execute the effect. It freezes the exact tool and arguments being presented for approval.

```ts
function requestConfirmation(
  state: ConfirmationState,
  tool: string,
  input: Record<string, unknown>,
): ConfirmationState {
  if (state.status !== 'ready') throw new Error(`Cannot request confirmation from ${state.status}`);
  return { status: 'pending', tool, input };
}

function canExecute(
  state: ConfirmationState,
  tool: string,
  input: Record<string, unknown>,
): boolean {
  return (
    state.status === 'approved' &&
    state.tool === tool &&
    JSON.stringify(state.input) === JSON.stringify(input)
  );
}
```

Approval is scoped to that exact action. A later model turn cannot silently replace the recipient or target record and reuse the earlier approval.

## Preview is not execution

A preview should explain what will change, who will be affected, and which stable identifiers are targeted. It must be safe to compute repeatedly. The effect happens only after approval.

```json
{
  "action": "invite_member",
  "collectionId": "collection-japan",
  "recipient": "alex@example.com",
  "message": "Alex will gain access to Japan restaurants"
}
```

Traces should record `confirmation_requested` separately from `tool_succeeded`.

## Dependent writes stop at the boundary

If a request contains multiple consequential actions, later writes must not run after the first action reaches confirmation. This is a runtime invariant, not a prompt instruction: a provider may emit several calls in one response.

```ts
const pending = requestConfirmation({ status: 'ready' }, 'remove_collection_item', {
  collectionId: 'collection-japan',
  entityId: 'person-alex',
});

if (!canExecute(pending, 'remove_collection_item', input)) {
  // Persist the pending action and stop execution.
}
```

## Rejection is a safety success

Rejected confirmation is not a failed tool call. It means user control was preserved.

```ts
const rejected = resolveConfirmation(pending, 'reject');
if (!canExecute(rejected, 'remove_collection_item', input)) {
  return { changed: false, reason: 'user_rejected_confirmation' };
}
```

The assistant should report no change and offer a safe next step. It should not retry the write or continue into dependent actions.

## Idempotency closes the retry gap

Approval flows cross UI, network, and worker boundaries. Every consequential effect needs an idempotency key tied to the generation and call identity.

```ts
const idempotencyKey = `${generationId}:${toolCallId}`;
const prior = await effectStore.get({ idempotencyKey, toolName });
if (prior) return prior;

const result = await executeOnce(input);
await effectStore.put({ idempotencyKey, toolName, result });
return result;
```

Idempotency makes an authorized action safe to retry; it does not replace authorization.

## Test the protocol, not only the flag

The Ori harness originally stopped after emitting a custom confirmation event. That tested whether the harness could stop, not whether the model could resume after approval or recover after rejection. The integrated protocol tests exercise those transitions, while [`chat-generation-engine.ts`](../../services/api/src/chat/chat-generation-engine.ts) enforces plan membership and prerequisite reads.

The remaining boundary matters: Ori’s local event type includes `tool.confirmation_required`, but the installed runtime reports that custom event as `undefined`. Raw model evaluation and integrated protocol evaluation therefore remain separate lanes until Ori exposes a first-class event contract.

Propose, pause, decide, then execute. Never compress those steps into one boolean.
