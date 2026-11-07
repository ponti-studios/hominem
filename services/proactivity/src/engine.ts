import {
  deliveryIntentSchema,
  evaluationRunSchema,
  goalContextSchema,
  goalSchema,
  proactivityDecisionSchema,
  proactivityTriggerSchema,
  type Evaluation,
  type Goal,
  type GoalOutcome,
  type ProactivityDependencies,
  type ProactivityTrigger,
} from './types.js';

export function createProactivityEngine(dependencies: ProactivityDependencies) {
  return { run: (input: ProactivityTrigger) => run(input, dependencies) };
}

async function run(input: ProactivityTrigger, dependencies: ProactivityDependencies) {
  const trigger = proactivityTriggerSchema.parse(input);
  const existing = await dependencies.journal.find(trigger.ownerId, trigger.id);
  if (existing) return existing;

  const goals = (await dependencies.goals.list(trigger.ownerId))
    .map((goal) => goalSchema.parse(goal))
    .filter((goal) => goal.ownerId === trigger.ownerId && goal.status === 'active');
  const candidates = selectGoals(goals, trigger);
  const outcomes: GoalOutcome[] = [];
  const evaluatedAt = dependencies.clock.now();
  const evaluations: Evaluation[] = [];

  for (const goal of candidates) {
    const context = goalContextSchema.parse(await dependencies.contexts.load(goal, trigger));
    assertContextMatches(context, goal, trigger);
    const decision = proactivityDecisionSchema.parse(await dependencies.slot.evaluate(context));
    assertEvidenceReferences(decision, context);
    outcomes.push({ context, decision });
    evaluations.push({
      ownerId: trigger.ownerId,
      triggerId: trigger.id,
      goalId: goal.id,
      evaluatedAt,
      decision,
    });
  }

  const deliveryIntents = (await dependencies.deliveryPolicy.plan({ trigger, outcomes })).map(
    (intent) => deliveryIntentSchema.parse(intent),
  );
  assertDeliveryIntents(deliveryIntents, trigger, outcomes);

  const run = evaluationRunSchema.parse({
    ownerId: trigger.ownerId,
    triggerId: trigger.id,
    processedAt: evaluatedAt,
    evaluations,
    deliveryIntents,
  });
  return dependencies.journal.commit(run);
}

function selectGoals(goals: Goal[], trigger: ProactivityTrigger): Goal[] {
  if (trigger.kind !== 'critical-change') return goals;

  const changedDomains = new Set(trigger.changedDomains);
  return goals.filter((goal) => goal.domains.some((domain) => changedDomains.has(domain)));
}

function assertContextMatches(
  context: GoalOutcome['context'],
  goal: Goal,
  trigger: ProactivityTrigger,
): void {
  if (context.goal.id !== goal.id || context.goal.ownerId !== trigger.ownerId) {
    throw new Error('Loaded goal context does not match the requested goal owner.');
  }
  if (context.trigger.id !== trigger.id || context.trigger.ownerId !== trigger.ownerId) {
    throw new Error('Loaded goal context does not match the evaluation trigger.');
  }
}

function assertEvidenceReferences(
  decision: ReturnType<typeof proactivityDecisionSchema.parse>,
  context: GoalOutcome['context'],
): void {
  const availableIds = new Set([
    ...context.current.evidence.map(({ id }) => id),
    ...(context.previous?.evidence.map(({ id }) => id) ?? []),
  ]);
  if (decision.evidenceIds.some((id) => !availableIds.has(id))) {
    throw new Error('Evaluator decision cites evidence outside the supplied goal context.');
  }
}

function assertDeliveryIntents(
  intents: ReturnType<typeof deliveryIntentSchema.parse>[],
  trigger: ProactivityTrigger,
  outcomes: GoalOutcome[],
): void {
  const outcomeByGoal = new Map(outcomes.map((outcome) => [outcome.context.goal.id, outcome]));
  const keys = new Set<string>();

  for (const intent of intents) {
    if (intent.ownerId !== trigger.ownerId)
      throw new Error('Delivery intent owner does not match trigger.');
    if (keys.has(intent.idempotencyKey))
      throw new Error('Delivery intent idempotency keys must be unique.');
    keys.add(intent.idempotencyKey);

    if (intent.kind === 'weekly-summary') {
      if (trigger.kind !== 'weekly-summary') {
        throw new Error('Weekly summary intent requires a weekly-summary trigger.');
      }
      continue;
    }

    const outcome = outcomeByGoal.get(intent.goalId);
    if (!outcome || outcome.decision.kind !== 'propose') {
      throw new Error('Goal proposal intent requires a proposed decision for an evaluated goal.');
    }
  }
}
