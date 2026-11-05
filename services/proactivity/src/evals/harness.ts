import { createProactivityEngine } from '../engine.js';
import { InMemoryJournal } from '../memory.js';
import type {
  DeliveryIntent,
  GoalOutcome,
  ProactivityDecision,
  ProactivityTrigger,
} from '../types.js';
import { evalReassessAt, type ExpectedDecisionKind, type ProactivityEvalCase } from './cases.js';

export type ProactivitySlot = {
  evaluate(context: {
    goal: ProactivityEvalCase['goal'];
    trigger: ProactivityTrigger;
    previous: ProactivityEvalCase['previous'] | null;
    current: ProactivityEvalCase['current'];
  }): Promise<ProactivityDecision>;
};

export type ProactivityEvalResult = {
  caseId: string;
  title: string;
  category: ProactivityEvalCase['category'];
  split: ProactivityEvalCase['split'];
  goalId: string;
  triggerKind: ProactivityTrigger['kind'];
  previousSnapshotId: string | null;
  currentSnapshotId: string;
  expected: ExpectedDecisionKind;
  actual: ExpectedDecisionKind | 'error';
  passed: boolean;
  failures: readonly string[];
  decision: ProactivityDecision | null;
  deliveryIntents: readonly DeliveryIntent[];
  latencyMs: number;
  error?: string;
};

export type ProactivityEvalSuite = 'all' | ProactivityEvalCase['split'];

export function selectEvalCases(
  cases: readonly ProactivityEvalCase[],
  suite: ProactivityEvalSuite,
): readonly ProactivityEvalCase[] {
  return suite === 'all' ? cases : cases.filter((input) => input.split === suite);
}

const MAX_SUMMARY = 160;
const MAX_REASON = 240;
const MAX_NEXT_STEP = 200;

export async function runProactivityEvalCase(
  input: ProactivityEvalCase,
  slot: ProactivitySlot,
): Promise<ProactivityEvalResult> {
  const startedAt = Date.now();
  const failures: string[] = [];
  const journal = new InMemoryJournal();

  const engine = createProactivityEngine({
    goals: {
      list: async (ownerId) => (ownerId === input.goal.ownerId ? [input.goal] : []),
    },
    contexts: {
      load: async (goal, trigger) => ({
        goal,
        trigger,
        previous: input.previous,
        current: input.current,
      }),
    },
    slot,
    deliveryPolicy: { plan: defaultDeliveryPlan },
    journal,
    clock: {
      now: () =>
        input.trigger.kind === 'critical-change' ? input.trigger.occurredAt : input.trigger.asOf,
    },
  });

  try {
    const run = await engine.run(input.trigger);

    if (input.expected.idempotentReplay) {
      const replay = await engine.run(input.trigger);
      const originalKeys = run.deliveryIntents.map(({ idempotencyKey }) => idempotencyKey).join();
      const replayKeys = replay.deliveryIntents.map(({ idempotencyKey }) => idempotencyKey).join();
      if (replay.evaluations.length !== run.evaluations.length) {
        failures.push(
          `Replay produced ${replay.evaluations.length} evaluations, expected ${run.evaluations.length}.`,
        );
      }
      if (replay.deliveryIntents.length !== run.deliveryIntents.length) {
        failures.push(
          `Replay produced ${replay.deliveryIntents.length} delivery intents, expected ${run.deliveryIntents.length}.`,
        );
      }
      if (replayKeys !== originalKeys) {
        failures.push('Replay produced different delivery idempotency keys.');
      }
    }

    const evaluations = run.evaluations;
    const decision = evaluations[0]?.decision ?? null;

    if (input.expected.decision === 'none') {
      if (evaluations.length !== 0) {
        failures.push(`Expected no evaluations, got ${evaluations.length}.`);
      }
      if (run.deliveryIntents.length !== 0) {
        failures.push(`Expected no delivery intents, got ${run.deliveryIntents.length}.`);
      }
      return result(input, decision, run.deliveryIntents, failures, startedAt);
    }

    if (evaluations.length !== 1) {
      failures.push(`Expected exactly one evaluation, got ${evaluations.length}.`);
    }
    if (evaluations[0] && evaluations[0].goalId !== input.goal.id) {
      failures.push(`Evaluation targeted ${evaluations[0].goalId}, not ${input.goal.id}.`);
    }
    if (decision === null) {
      failures.push('No decision returned.');
      return result(input, decision, run.deliveryIntents, failures, startedAt);
    }

    if (decision.kind !== input.expected.decision) {
      failures.push(`Expected "${input.expected.decision}", got "${decision.kind}".`);
    }

    const available = new Set([
      ...input.current.evidence.map(({ id }) => id),
      ...input.previous.evidence.map(({ id }) => id),
    ]);
    for (const id of decision.evidenceIds) {
      if (!available.has(id)) failures.push(`Decision cited unavailable evidence "${id}".`);
    }
    const cited = new Set(decision.evidenceIds);
    for (const id of input.expected.requiredEvidenceIds ?? []) {
      if (!cited.has(id)) {
        failures.push(`Decision did not cite required evidence "${id}".`);
      }
    }

    const prose = collectProse(decision).toLowerCase();
    for (const term of input.expected.forbiddenTerms ?? []) {
      if (prose.includes(term.toLowerCase())) {
        failures.push(`Decision repeated forbidden term "${term}".`);
      }
    }

    const goalProposals = run.deliveryIntents.filter((intent) => intent.kind === 'goal-proposal');
    if (input.expected.decision === 'propose') {
      if (decision.evidenceIds.length === 0) {
        failures.push('A proposal must cite at least one evidence id.');
      }
      if (goalProposals.length !== 1) {
        failures.push(`Expected one goal-proposal delivery intent, got ${goalProposals.length}.`);
      }
    } else if (goalProposals.length !== 0) {
      failures.push(`A "${input.expected.decision}" case must not deliver a goal proposal.`);
    }

    if (decision.kind === 'propose') {
      if (decision.summary.length > MAX_SUMMARY) {
        failures.push(`Summary exceeds ${MAX_SUMMARY} characters.`);
      }
      if (decision.reason.length > MAX_REASON) {
        failures.push(`Reason exceeds ${MAX_REASON} characters.`);
      }
      if (decision.nextStep.length > MAX_NEXT_STEP) {
        failures.push(`Next step exceeds ${MAX_NEXT_STEP} characters.`);
      }
    }

    return result(input, decision, run.deliveryIntents, failures, startedAt);
  } catch (error) {
    const message = describeError(error);
    failures.push(`Evaluation threw: ${message}`);
    return {
      ...result(input, null, [], failures, startedAt),
      actual: 'error',
      error: message,
    };
  }
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.cause instanceof Error) return `${error.message} · ${error.cause.message}`;
  if (error.cause !== undefined) return `${error.message} · ${String(error.cause)}`;
  return error.message;
}

export async function runProactivityEvalSuite(
  cases: readonly ProactivityEvalCase[],
  slot: ProactivitySlot,
  options: { onResult?: (result: ProactivityEvalResult) => void } = {},
): Promise<ProactivityEvalResult[]> {
  const results: ProactivityEvalResult[] = [];
  for (const input of cases) {
    const result = await runProactivityEvalCase(input, slot);
    options.onResult?.(result);
    results.push(result);
  }
  return results;
}

export function createExpectedSlot(cases: readonly ProactivityEvalCase[]): ProactivitySlot {
  const byGoal = new Map(cases.map((input) => [input.goal.id, input]));

  return {
    async evaluate({ goal }) {
      const input = byGoal.get(goal.id);
      if (!input) throw new Error(`No eval case for goal ${goal.id}.`);
      const evidenceIds = [...(input.expected.requiredEvidenceIds ?? [])];

      switch (input.expected.decision) {
        case 'propose':
          return {
            kind: 'propose',
            summary: input.title,
            reason: input.expected.rationale,
            nextStep: 'Review the goal against the cited evidence.',
            evidenceIds,
          };
        case 'defer':
          return {
            kind: 'defer',
            reason: input.expected.rationale,
            reevaluateAt: evalReassessAt,
            evidenceIds,
          };
        case 'quiet':
          return {
            kind: 'quiet',
            reason: input.expected.rationale,
            evidenceIds,
          };
        case 'none':
          throw new Error('A "none" case must not reach the evaluator slot.');
      }
    },
  };
}

function result(
  input: ProactivityEvalCase,
  decision: ProactivityDecision | null,
  deliveryIntents: readonly DeliveryIntent[],
  failures: string[],
  startedAt: number,
): ProactivityEvalResult {
  return {
    caseId: input.id,
    title: input.title,
    category: input.category,
    split: input.split,
    goalId: input.goal.id,
    triggerKind: input.trigger.kind,
    previousSnapshotId: input.previous?.id ?? null,
    currentSnapshotId: input.current.id,
    expected: input.expected.decision,
    actual:
      input.expected.decision === 'none' && decision === null
        ? 'none'
        : (decision?.kind ?? 'error'),
    passed: failures.length === 0,
    failures,
    decision,
    deliveryIntents,
    latencyMs: Date.now() - startedAt,
  };
}

function collectProse(decision: ProactivityDecision): string {
  if (decision.kind === 'propose') {
    return [decision.summary, decision.reason, decision.nextStep].join(' ');
  }
  return decision.reason;
}

async function defaultDeliveryPlan({
  trigger,
  outcomes,
}: {
  trigger: ProactivityTrigger;
  outcomes: GoalOutcome[];
}): Promise<DeliveryIntent[]> {
  const sendAt = trigger.kind === 'critical-change' ? trigger.occurredAt : trigger.asOf;
  const intents: DeliveryIntent[] = outcomes.flatMap(({ context, decision }) =>
    decision.kind === 'propose'
      ? [
          {
            kind: 'goal-proposal',
            idempotencyKey: `${trigger.id}:${context.goal.id}`,
            ownerId: trigger.ownerId,
            goalId: context.goal.id,
            channel: 'email',
            subject: decision.summary,
            body: `${decision.reason} ${decision.nextStep}`,
            sendAt,
          },
        ]
      : [],
  );
  if (trigger.kind === 'weekly-summary') {
    intents.push({
      kind: 'weekly-summary',
      idempotencyKey: `weekly-summary:${trigger.id}`,
      ownerId: trigger.ownerId,
      goalId: null,
      channel: 'email',
      subject: 'Your week across active goals',
      body: 'A summary grounded in the current goal state.',
      sendAt: trigger.asOf,
    });
  }
  return intents;
}
