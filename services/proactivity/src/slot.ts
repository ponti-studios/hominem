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
- Never take or recommend an irreversible action: no moving money, paying, transferring, buying,
  booking, cancelling, signing, contacting people, or committing the user to anything.
- nextStep must be a reversible review, plan, or preparation step the person can choose to take. It
  may ask them to review, compare, plan, prepare, schedule their own time, or decide. It must not
  instruct them to move money, pay, transfer, buy, book, cancel, change a booking, contact anyone, or
  commit to anything.
- Do not ask questions or offer follow-up work. nextStep is one concrete, safe action.
- Write to the person in plain second person ("you"), as a calm assistant. Do not role-play and do
  not address a third party.
- Write for a person, not an engineer: no evidence ids, JSON field names, camelCase, or words like
  "dataQuality" in summary, reason, or nextStep. Put evidence ids only in evidenceIds.
- When a fact is money, include the currency symbol once (for example, £3,120). When a fact is a
  count, use the unit the evidence supplies. Never round away a meaningful difference.
- The summary is the one line a person reads first; the reason explains what changed in human terms
  without repeating the summary; nextStep is one small, safe action.
- Write dates and times for a person (for example, "Thursday 5 November at 13:00"), never as ISO
  strings such as 2026-11-05.
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
  numbers changed. Do not propose "record", "update", "confirm", "monitor", or "recalculate" work.
- A refund, credit, correction, or reconciliation that brings the current figure back inside the
  goal's limit is a resolution, not a new decision. Quiet.
- Defer for stale, duplicate, unreconciled, conflicting, or missing required evidence. Verification and
  data cleanup are deferrals, not proposals.

Never quote or paraphrase private notes, condition names, treatments, or other sensitive details from
the evidence, even as an example.

Keep summary under 120 characters, reason under 170 characters, and nextStep under 155 characters.
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
  summary: z.string().max(240).nullable(),
  reason: z.string().max(400),
  nextStep: z.string().max(320).nullable(),
  reevaluateAt: z.string().nullable(),
  evidenceIds: z.array(z.string()),
});

export type ModelDecision = z.infer<typeof modelDecisionSchema>;

export function toProactivityDecision(input: ModelDecision): ProactivityDecision {
  switch (input.kind) {
    case 'propose':
      return proactivityDecisionSchema.parse({
        kind: 'propose',
        summary: tidyProse(input.summary ?? '', 140),
        reason: tidyProse(input.reason, 200),
        nextStep: tidyProse(input.nextStep ?? '', 180),
        evidenceIds: input.evidenceIds,
      });
    case 'defer':
      return proactivityDecisionSchema.parse({
        kind: 'defer',
        reason: tidyProse(input.reason, 200),
        reevaluateAt:
          normalizeTimestamp(input.reevaluateAt) ?? new Date(Date.now() + 7 * DAY_MS).toISOString(),
        evidenceIds: input.evidenceIds,
      });
    case 'quiet':
      return proactivityDecisionSchema.parse({
        kind: 'quiet',
        reason: tidyProse(input.reason, 200),
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

export function createModelSlot({ generate, maxAttempts = 3 }: ModelSlotOptions) {
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
          const sanitized = sanitizeProse(decision, context, available);
          assertUserFacingCopy(sanitized, context, available);
          try {
            assertSafeNextStep(sanitized);
          } catch (error) {
            if (attempt === maxAttempts) return withSafeNextStep(sanitized);
            throw error;
          }
          return sanitized;
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

function sanitizeProse(
  decision: ProactivityDecision,
  context: GoalContext,
  available: Set<string>,
): ProactivityDecision {
  const evidenceById = new Map(
    [...context.current.evidence, ...(context.previous?.evidence ?? [])].map((item) => [
      item.id,
      item,
    ]),
  );
  const fieldNames = new Set<string>();
  for (const item of [...context.current.evidence, ...(context.previous?.evidence ?? [])]) {
    for (const key of Object.keys(item.facts)) {
      if (/[A-Z_]/.test(key)) fieldNames.add(key);
    }
  }

  const clean = (text: string): string => {
    let out = text;
    for (const id of available) {
      if (!out.includes(id)) continue;
      const source = evidenceById.get(id)?.source;
      const label =
        source && source !== 'eval-fixture' && source !== 'synthetic-fixture' && source !== 'test'
          ? `${source} data`
          : 'the latest evidence';
      out = out.split(id).join(label);
    }
    for (const key of fieldNames) {
      if (out.includes(key)) out = out.split(key).join(humanizeField(key));
    }
    out = out.replace(ISO_DATE, (match, year, month, day, hour, minute) => {
      const date = new Date(`${year}-${month}-${day}T${hour ?? '00'}:${minute ?? '00'}:00.000Z`);
      if (Number.isNaN(date.getTime())) return match;
      const label = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
      return hour ? `${label} at ${hour}:${minute}` : label;
    });
    return out.replace(/\s+/g, ' ').trim();
  };

  if (decision.kind === 'propose') {
    return {
      ...decision,
      summary: clean(decision.summary),
      reason: clean(decision.reason),
      nextStep: clean(decision.nextStep),
    };
  }
  return { ...decision, reason: clean(decision.reason) };
}

function humanizeField(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();
}

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?)?\b/g;

function collectLeakedTerms(
  decision: ProactivityDecision,
  context: GoalContext,
  available: Set<string>,
): string[] {
  const prose =
    decision.kind === 'propose'
      ? `${decision.summary} ${decision.reason} ${decision.nextStep}`
      : decision.reason;
  const evidenceIds = [...available].filter((id) => prose.includes(id));
  const isoDate = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/.exec(prose)?.[0];
  const factKeys = new Set<string>();
  for (const item of [...context.current.evidence, ...(context.previous?.evidence ?? [])]) {
    for (const key of Object.keys(item.facts)) {
      if (/[A-Z_]/.test(key)) factKeys.add(key);
    }
  }
  const keys = [...factKeys].filter((key) => prose.includes(key));
  return [...new Set([...evidenceIds, ...keys, ...(isoDate ? [isoDate] : [])])];
}

const UNSAFE_NEXT_STEP =
  /\b(pay|paid|transfer|buy|purchase|book|cancel|sign|commit|invest|donate|withdraw)\b|\b(call|contact|email|message|send)\s+(the|a|an|your|their|his|her|them|him|someone|anyone)\b|\breach out\b|\bfollow up with\b|\b(move|shift|top up|reallocate)\b[\s\S]{0,12}?(£|funds|money|cash)|\b(change|amend|modify)\s+(the|your)\s+booking\b/i;

const SAFE_NEXT_STEP = 'Review the change and decide which option fits your plan.';

function withSafeNextStep(decision: ProactivityDecision): ProactivityDecision {
  if (decision.kind !== 'propose') return decision;
  return { ...decision, nextStep: SAFE_NEXT_STEP };
}

function assertSafeNextStep(decision: ProactivityDecision): void {
  if (decision.kind !== 'propose') return;
  const unsafe = UNSAFE_NEXT_STEP.exec(decision.nextStep)?.[0];
  if (unsafe) {
    throw new Error(
      `nextStep recommends an irreversible or committed action ("${unsafe}" in "${decision.nextStep}"). Rewrite it as a reversible review, plan, or preparation step the person can choose to take.`,
    );
  }
}

function assertUserFacingCopy(
  decision: ProactivityDecision,
  context: GoalContext,
  available: Set<string>,
): void {
  const leaked = collectLeakedTerms(decision, context, available);
  if (leaked.length > 0) {
    throw new Error(
      `The prose leaked implementation details (${leaked.join(', ')}). Rewrite summary, reason, and nextStep in plain language without evidence ids, field names, camelCase, or ISO dates.`,
    );
  }
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

function tidyProse(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length < max - 1) return trimmed;
  if (/[.!?…]$/.test(trimmed)) return trimmed;
  const cut = trimmed.slice(0, max);
  const boundary = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('; '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
    cut.lastIndexOf(', '),
    cut.lastIndexOf(' — '),
    cut.lastIndexOf('—'),
  );
  if (boundary >= Math.floor(max * 0.5)) {
    const mark = ['.', '!', '?'].includes(cut[boundary] ?? '') ? cut[boundary] : '.';
    return `${cut.slice(0, boundary)}${mark ?? '.'}`;
  }
  const lastSpace = cut.lastIndexOf(' ');
  const end = lastSpace > 0 ? lastSpace : cut.length;
  return `${cut.slice(0, end).replace(/[\s,;:.!?-]+$/, '')}…`;
}

function normalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00:00.000Z`;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
