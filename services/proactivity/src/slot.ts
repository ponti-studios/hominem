import { z } from 'zod';

import { proactivityDecisionSchema, type GoalContext, type ProactivityDecision } from './types.js';

const PROACTIVITY_SCHEMA_NAME = 'proactivity_decision';
const PROACTIVITY_SCHEMA_DESCRIPTION =
  'One goal evaluation decision, grounded only in the supplied goal and state evidence.';

const SYSTEM_PROMPT = `You are the proactivity evaluator for Hominem, a personal assistant.

You receive one active goal and the prior and current state of the world. Decide whether the new
state warrants an interruption.

Return exactly one decision:

- "propose" when the new state materially changes the goal's outlook or needs a concrete next step.
  Cite at least one supplied evidence id and name the specific fact that changed.
- "defer" when the evidence is missing, stale, conflicting, or insufficient to decide. Say what is
  missing and when to reassess.
- "quiet" when nothing material changed, the change is unrelated to this goal, or the goal is
  already on track. Quiet is the correct default.

Rules:
- Use only the supplied evidence. Never invent amounts, dates, names, diagnoses, or outcomes.
- Cite only evidence ids that appear in "Available evidence ids".
- Do not treat a change as material just because it happened in a goal's domain. Compare the prior
  and current facts and explain the effect on this goal.
- Never take or recommend an irreversible action: no moving money, contacting people, buying, or
  committing the user to anything.
- Do not ask questions or offer follow-up work. nextStep is one concrete, safe action.
- Write about the user's goal in neutral, third-person terms; do not role-play.
- Do not repeat sensitive personal details. Refer to them generally.

Before deciding, run these grounding checks:
1. Compare the prior and current facts for this goal, not merely the changed domain.
2. Prefer adjusted or net figures when supplied: a refund, credit, or transfer changes the effective
   amount.
3. If two current facts disagree on the same quantity, you must defer instead of choosing one.
4. If a required fact is null, absent, or marked unknown, you must defer and name what is missing.
5. Check observedAt on the newest relevant current evidence. If it is more than seven days older than
   the trigger time, you must defer and ask for a fresh observation.
6. If the evidence flags duplicates, reconciliation issues, or unverified records, you must defer.
7. If the goal is already achieved, clearly on track, or the change is only progress, quiet.

Decision threshold:
- Propose only when the new state creates a decision or risk the user has not already planned for, and
  the evidence supports one concrete next step.
- Quiet for progress, achieved goals, bookkeeping, confirmations, and status updates, even when the
  numbers changed. Do not propose "record", "update", "confirm", or "recalculate" work.
- Defer for stale, duplicate, unreconciled, conflicting, or missing required evidence. Verification and
  data cleanup are deferrals, not proposals.

Never quote or paraphrase private notes, condition names, treatments, or other sensitive details from
the evidence, even as an example.

Keep summary under 160 characters, reason under 240 characters, and nextStep under 200 characters.
Always include every field in the schema. Use null for summary, nextStep, or reevaluateAt when they do
not apply to the chosen kind.
Output JSON only, matching the supplied schema.`;

/**
 * The model-facing shape is deliberately flat: some providers reject the
 * `oneOf` that a discriminated union produces. Every field is required, with
 * null standing in for "not applicable"; `toProactivityDecision` narrows it to
 * the internal union and enforces the per-kind rules.
 */
export const modelDecisionSchema = z.object({
  kind: z.enum(['propose', 'defer', 'quiet']),
  summary: z.string().max(160).nullable(),
  reason: z.string().max(240),
  nextStep: z.string().max(200).nullable(),
  reevaluateAt: z.string().nullable(),
  evidenceIds: z.array(z.string()),
});

export type ModelDecision = z.infer<typeof modelDecisionSchema>;

export function toProactivityDecision(input: ModelDecision): ProactivityDecision {
  switch (input.kind) {
    case 'propose':
      return proactivityDecisionSchema.parse({
        kind: 'propose',
        summary: input.summary ?? '',
        reason: input.reason,
        nextStep: input.nextStep ?? '',
        evidenceIds: input.evidenceIds,
      });
    case 'defer':
      return proactivityDecisionSchema.parse({
        kind: 'defer',
        reason: input.reason,
        reevaluateAt:
          normalizeTimestamp(input.reevaluateAt) ?? new Date(Date.now() + 7 * DAY_MS).toISOString(),
        evidenceIds: input.evidenceIds,
      });
    case 'quiet':
      return proactivityDecisionSchema.parse({
        kind: 'quiet',
        reason: input.reason,
        evidenceIds: input.evidenceIds,
      });
  }
}

export type ProactivityGenerateRequest = {
  system: string;
  prompt: string;
  schemaName: string;
  schemaDescription: string;
};

export type ProactivityGenerate = (request: ProactivityGenerateRequest) => Promise<unknown>;

export type ModelSlotOptions = {
  generate: ProactivityGenerate;
  /** Total attempts when the model returns an invalid or ungrounded decision. */
  maxAttempts?: number;
};

const DAY_MS = 86_400_000;
const BLOCKING_DATA_QUALITY = new Set([
  'duplicate_unreconciled',
  'missing_current_measurements',
  'missing_required_support_hours',
  'stale',
]);

/**
 * Deterministic grounding checks. These do not judge materiality; they stop the
 * model from evaluating when the supplied state cannot support a trustworthy
 * decision. The model handles the remaining propose/defer/quiet judgement.
 */
export function preflight(context: GoalContext): ProactivityDecision | null {
  const current = context.current.evidence;
  const triggerAt = Date.parse(
    context.trigger.kind === 'critical-change' ? context.trigger.occurredAt : context.trigger.asOf,
  );
  const reevaluateAt = new Date(triggerAt + 7 * DAY_MS).toISOString();

  if (current.length === 0) {
    return proactivityDecisionSchema.parse({
      kind: 'defer',
      reason: 'No current evidence is available for this goal.',
      reevaluateAt,
      evidenceIds: [],
    });
  }

  for (const item of current) {
    const quality = item.facts.dataQuality;
    if (typeof quality === 'string' && BLOCKING_DATA_QUALITY.has(quality)) {
      return proactivityDecisionSchema.parse({
        kind: 'defer',
        reason: `Evidence ${item.id} is flagged as ${quality}; deferring until it is resolved.`,
        reevaluateAt,
        evidenceIds: [item.id],
      });
    }
  }

  const newest = current.reduce((latest, item) =>
    Date.parse(item.observedAt) > Date.parse(latest.observedAt) ? item : latest,
  );
  if (Number.isFinite(triggerAt) && triggerAt - Date.parse(newest.observedAt) > 7 * DAY_MS) {
    return proactivityDecisionSchema.parse({
      kind: 'defer',
      reason: `The newest current evidence is more than seven days old; request a fresh observation.`,
      reevaluateAt,
      evidenceIds: [newest.id],
    });
  }

  return null;
}

export class ProactivitySlotError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProactivitySlotError';
  }
}

export function buildProactivityPrompt(context: GoalContext): string {
  const availableEvidenceIds = collectEvidenceIds(context);
  const trigger =
    context.trigger.kind === 'critical-change'
      ? `critical change in ${context.trigger.changedDomains.join(', ')} at ${context.trigger.occurredAt}`
      : `${context.trigger.kind} as of ${context.trigger.asOf}`;

  return [
    `Trigger: ${trigger}`,
    `Goal: ${context.goal.title} (${context.goal.id})`,
    `Goal domains: ${context.goal.domains.join(', ')}`,
    `Available evidence ids: ${availableEvidenceIds.join(', ') || '(none)'}`,
    '',
    'Previous state:',
    JSON.stringify(context.previous, null, 2),
    '',
    'Current state:',
    JSON.stringify(context.current, null, 2),
  ].join('\n');
}

function collectEvidenceIds(context: GoalContext): string[] {
  return [
    ...context.current.evidence.map(({ id }) => id),
    ...(context.previous?.evidence.map(({ id }) => id) ?? []),
  ];
}

export function createModelSlot({ generate, maxAttempts = 2 }: ModelSlotOptions) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }

  return {
    async evaluate(context: GoalContext): Promise<ProactivityDecision> {
      const guarded = preflight(context);
      if (guarded) return guarded;

      const available = new Set(collectEvidenceIds(context));
      let feedback = '';
      let lastError: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const raw = await generate({
            system: SYSTEM_PROMPT,
            prompt: `${buildProactivityPrompt(context)}${feedback}`,
            schemaName: PROACTIVITY_SCHEMA_NAME,
            schemaDescription: PROACTIVITY_SCHEMA_DESCRIPTION,
          });
          const decision = proactivityDecisionSchema.parse(raw);
          const unknownEvidence = decision.evidenceIds.filter((id) => !available.has(id));
          if (unknownEvidence.length > 0) {
            throw new Error(
              `The decision cited evidence not supplied in this goal context: ${unknownEvidence.join(', ')}.`,
            );
          }
          return decision;
        } catch (error) {
          lastError = error;
          feedback = correctionFor(error, available);
        }
      }

      throw new ProactivitySlotError(
        `The evaluator did not return a valid grounded decision after ${maxAttempts} attempt(s).`,
        lastError,
      );
    },
  };
}

function correctionFor(error: unknown, available: Set<string>): string {
  const ids = [...available].join(', ') || '(none)';
  if (error instanceof z.ZodError) {
    const issues = error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    return `\n\nYour previous answer did not match the decision schema (${issues}). Return valid JSON using only the available evidence ids: ${ids}.`;
  }
  if (error instanceof Error) {
    return `\n\nYour previous answer was rejected: ${error.message} Use only these evidence ids: ${ids}.`;
  }
  return `\n\nYour previous answer was rejected. Use only these evidence ids: ${ids}.`;
}

function normalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00:00.000Z`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
