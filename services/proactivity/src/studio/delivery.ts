import type {
  DeliveryIntent,
  GoalOutcome,
  ProactivityDependencies,
  ProactivityTrigger,
} from '../types.js';
import type { StudioStore } from './store.js';

type DeliveryPolicy = ProactivityDependencies['deliveryPolicy'];

export type StudioDeliveryOptions = {
  store: StudioStore;
  clock: { now(): string };
  ownerFirstName: string;
};

/**
 * Turns proposed decisions into the emails the person would actually receive.
 * Deferrals and quiet outcomes never produce a delivery intent. A live
 * preference (snooze or mute) suppresses the email while leaving the
 * evaluation itself untouched, so the decision stays auditable.
 */
export function createStudioDeliveryPolicy(options: StudioDeliveryOptions): DeliveryPolicy {
  return {
    plan: ({ trigger, outcomes }) => Promise.resolve(plan(trigger, outcomes, options)),
  };
}

function plan(
  trigger: ProactivityTrigger,
  outcomes: GoalOutcome[],
  options: StudioDeliveryOptions,
): DeliveryIntent[] {
  const now = options.clock.now();
  const intents: DeliveryIntent[] = [];

  for (const outcome of outcomes) {
    if (outcome.decision.kind !== 'propose') continue;
    if (options.store.activePreference(outcome.context.goal.id, now)) continue;

    const { decision, context } = outcome;
    intents.push({
      kind: 'goal-proposal',
      idempotencyKey: `${trigger.id}:${context.goal.id}`,
      ownerId: trigger.ownerId,
      goalId: context.goal.id,
      channel: 'email',
      subject: subjectFor(decision.summary),
      body: bodyFor({
        ownerFirstName: options.ownerFirstName,
        goalTitle: context.goal.title,
        summary: decision.summary,
        reason: decision.reason,
        nextStep: decision.nextStep,
      }),
      sendAt: now,
    });
  }

  return intents;
}

function subjectFor(summary: string): string {
  const trimmed = summary.trim().replace(/\s+/g, ' ');
  return trimmed.length <= 92 ? trimmed : `${trimmed.slice(0, 89).trimEnd()}…`;
}

function bodyFor(input: {
  ownerFirstName: string;
  goalTitle: string;
  summary: string;
  reason: string;
  nextStep: string;
}): string {
  return [
    `Hi ${input.ownerFirstName},`,
    '',
    input.summary,
    '',
    input.reason,
    '',
    `A small next step: ${input.nextStep}`,
    '',
    `You asked Hominem to watch "${input.goalTitle}". This is the only message for it today.`,
    '',
    '— Hominem',
  ].join('\n');
}
