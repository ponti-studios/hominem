import { z } from 'zod';

const idSchema = z.string().min(1);
const timestampSchema = z.iso.datetime();

export const goalSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  title: z.string().min(1),
  status: z.enum(['active', 'paused', 'achieved']),
  domains: z.array(z.string().min(1)),
});

export type Goal = z.infer<typeof goalSchema>;

const evidenceSchema = z.object({
  id: idSchema,
  domain: z.string().min(1),
  source: z.string().min(1),
  observedAt: timestampSchema,
  facts: z.record(z.string(), z.unknown()),
});

export type Evidence = z.infer<typeof evidenceSchema>;

export const stateSnapshotSchema = z.object({
  id: idSchema,
  asOf: timestampSchema,
  evidence: z.array(evidenceSchema),
});

export type StateSnapshot = z.infer<typeof stateSnapshotSchema>;

export const proactivityTriggerSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('critical-change'),
    id: idSchema,
    ownerId: idSchema,
    changedDomains: z.array(z.string().min(1)).min(1),
    occurredAt: timestampSchema,
  }),
  z.object({
    kind: z.literal('scheduled-pass'),
    id: idSchema,
    ownerId: idSchema,
    asOf: timestampSchema,
  }),
  z.object({
    kind: z.literal('weekly-summary'),
    id: idSchema,
    ownerId: idSchema,
    asOf: timestampSchema,
  }),
]);

export type ProactivityTrigger = z.infer<typeof proactivityTriggerSchema>;

export const goalContextSchema = z.object({
  goal: goalSchema,
  trigger: proactivityTriggerSchema,
  previous: stateSnapshotSchema.nullable(),
  current: stateSnapshotSchema,
});

export type GoalContext = z.infer<typeof goalContextSchema>;

const evidenceIdsSchema = z.array(idSchema);

export const proactivityDecisionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('propose'),
    summary: z.string().min(1).max(140),
    reason: z.string().min(1).max(200),
    nextStep: z.string().min(1).max(180),
    evidenceIds: evidenceIdsSchema.min(1),
  }),
  z.object({
    kind: z.literal('defer'),
    reason: z.string().min(1).max(200),
    reevaluateAt: timestampSchema,
    evidenceIds: evidenceIdsSchema,
  }),
  z.object({
    kind: z.literal('quiet'),
    reason: z.string().min(1).max(200),
    evidenceIds: evidenceIdsSchema,
  }),
]);

export type ProactivityDecision = z.infer<typeof proactivityDecisionSchema>;

export const deliveryIntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('goal-proposal'),
    idempotencyKey: idSchema,
    ownerId: idSchema,
    goalId: idSchema,
    channel: z.literal('email'),
    subject: z.string().min(1),
    body: z.string().min(1),
    sendAt: timestampSchema,
  }),
  z.object({
    kind: z.literal('weekly-summary'),
    idempotencyKey: idSchema,
    ownerId: idSchema,
    goalId: z.null(),
    channel: z.literal('email'),
    subject: z.string().min(1),
    body: z.string().min(1),
    sendAt: timestampSchema,
  }),
]);

export type DeliveryIntent = z.infer<typeof deliveryIntentSchema>;

export const evaluationSchema = z.object({
  ownerId: idSchema,
  triggerId: idSchema,
  goalId: idSchema,
  evaluatedAt: timestampSchema,
  decision: proactivityDecisionSchema,
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export const evaluationRunSchema = z.object({
  ownerId: idSchema,
  triggerId: idSchema,
  processedAt: timestampSchema,
  evaluations: z.array(evaluationSchema),
  deliveryIntents: z.array(deliveryIntentSchema),
});

export type EvaluationRun = z.infer<typeof evaluationRunSchema>;

export type GoalOutcome = {
  context: GoalContext;
  decision: ProactivityDecision;
};

export type ProactivityDependencies = {
  goals: { list(ownerId: string): Promise<Goal[]> };
  contexts: { load(goal: Goal, trigger: ProactivityTrigger): Promise<GoalContext> };
  slot: { evaluate(context: GoalContext): Promise<ProactivityDecision> };
  deliveryPolicy: {
    plan(input: {
      trigger: ProactivityTrigger;
      outcomes: GoalOutcome[];
    }): Promise<DeliveryIntent[]>;
  };
  journal: EvaluationJournal;
  clock: { now(): string };
};

export type EvaluationJournal = {
  find(ownerId: string, triggerId: string): Promise<EvaluationRun | null>;
  commit(run: EvaluationRun): Promise<EvaluationRun>;
};
