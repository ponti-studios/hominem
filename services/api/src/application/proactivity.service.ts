import { db, sql } from '@hominem/db/core';
import { GoalsRepository, type GoalRecord } from '@hominem/db/goals';
import {
  adjustMonthlyFlows,
  createCareerContextLoader,
  createDomainContextAssembler,
  createFinanceContextLoader,
  createProactivityEngine,
  reconcileTransferPairs,
  type DeliveryIntent,
  type EvaluationRun,
  type Goal,
  type GoalOutcome,
  type ProactivityCareerSummary,
  type ProactivityDependencies,
  type ProactivityFinanceSummary,
  type ProactivityGoalView,
  type ProactivityOverview,
  type ProactivityTrigger,
} from '@hominem/proactivity';
import { createOpenRouterProactivitySlot } from '@hominem/proactivity/openrouter';

import { loadLatestRun, postgresJournal } from './proactivity-journal';

type Row = Record<string, unknown>;
const str = (value: unknown): string => String(value ?? '');
const num = (value: unknown): number => Number(value ?? 0);

function toGoalView(row: GoalRecord): ProactivityGoalView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    domains: row.domains,
    description: row.description,
    targetAt: row.targetAt,
  };
}

async function loadFinance(userId: string): Promise<ProactivityFinanceSummary | null> {
  const months = await sql<Row>`
    SELECT to_char(date_trunc('month', posted_on), 'YYYY-MM') AS month,
           round(sum(amount) FILTER (WHERE transaction_type = 'credit')::numeric, 2) AS income,
           round((-sum(amount) FILTER (WHERE transaction_type = 'debit'))::numeric, 2) AS spend
    FROM app.finance_transactions
    WHERE excluded = false AND transaction_type IN ('credit', 'debit') AND user_id = ${userId}
      AND posted_on >= date_trunc('month', now()) - interval '5 months'
    GROUP BY 1 ORDER BY 1
  `.execute(db);
  if (months.rows.length === 0) return null;

  const categories = await sql<Row>`
    SELECT to_char(date_trunc('month', t.posted_on), 'YYYY-MM') AS month,
           coalesce(c.name, 'Uncategorized') AS category,
           round((-sum(t.amount))::numeric, 2) AS spend
    FROM app.finance_transactions t
    LEFT JOIN app.finance_categories c ON c.id = t.category_id
    WHERE t.excluded = false AND t.transaction_type = 'debit' AND t.user_id = ${userId}
      AND t.posted_on >= date_trunc('month', now()) - interval '1 month'
      AND coalesce(c.name, 'Uncategorized') <> 'Transfers'
    GROUP BY 1, 2 HAVING sum(t.amount) < -20 ORDER BY 1, spend DESC
  `.execute(db);
  const incomeEvents = await sql<Row>`
    SELECT to_char(posted_on, 'YYYY-MM-DD') AS date, merchant_name AS source,
           round(amount::numeric, 2) AS amount
    FROM app.finance_transactions
    WHERE transaction_type = 'credit' AND excluded = false AND amount > 100 AND user_id = ${userId}
      AND posted_on >= now() - interval '45 days'
    ORDER BY posted_on DESC
  `.execute(db);
  const recentFlows = await sql<Row>`
    SELECT to_char(posted_on, 'YYYY-MM-DD') AS date, transaction_type AS direction,
           merchant_name AS merchant, round(amount::numeric, 2) AS amount
    FROM app.finance_transactions
    WHERE transaction_type IN ('credit', 'debit') AND excluded = false AND abs(amount) > 100
      AND user_id = ${userId} AND posted_on >= date_trunc('month', now()) - interval '5 months'
    ORDER BY posted_on
  `.execute(db);
  const accounts = await sql<Row>`
    SELECT account_type, count(*) AS accounts FROM app.finance_accounts
    WHERE lifecycle_status = 'open' AND user_id = ${userId} GROUP BY 1 ORDER BY 2 DESC
  `.execute(db);

  return {
    months: months.rows.map((row: Row) => ({
      month: str(row.month),
      income: num(row.income),
      spend: num(row.spend),
    })),
    categories: categories.rows.map((row: Row) => ({
      month: str(row.month),
      category: str(row.category),
      spend: num(row.spend),
    })),
    incomeEvents: incomeEvents.rows.map((row: Row) => ({
      date: str(row.date),
      source: str(row.source),
      amount: num(row.amount),
    })),
    recentFlows: recentFlows.rows.map((row: Row) => ({
      date: str(row.date),
      direction: str(row.direction) === 'credit' ? 'credit' : 'debit',
      merchant: str(row.merchant),
      amount: num(row.amount),
    })),
    openAccountsByType: accounts.rows.map((row: Row) => ({
      accountType: str(row.accountType),
      accounts: num(row.accounts),
    })),
    generatedAt: new Date().toISOString(),
  };
}

async function loadCareer(userId: string): Promise<ProactivityCareerSummary | null> {
  const result = await sql<Row>`
    SELECT count(*) AS total,
           to_char(max(applied_at), 'YYYY-MM-DD') AS last_application,
           count(*) FILTER (WHERE applied_at >= now() - interval '120 days') AS last_120
    FROM app.career_applications WHERE owner_userid = ${userId}
  `.execute(db);
  const row = result.rows[0];
  if (!row || num(row.total) === 0) return null;
  return {
    lastApplicationDate: str(row.lastApplication) || null,
    totalApplications: num(row.total),
    applicationsLast120Days: num(row.last120),
  };
}

export async function loadOverview(userId: string): Promise<ProactivityOverview> {
  const [goalRows, finance, career, lastRun] = await Promise.all([
    GoalsRepository.listByOwner(db, { userId }),
    loadFinance(userId),
    loadCareer(userId),
    loadLatestRun(userId),
  ]);
  return {
    goals: goalRows.map(toGoalView),
    finance: finance
      ? {
          ...finance,
          // Same reconciliation the engine's snapshots apply, so the series the
          // app shows cannot disagree with the figures the model reasons about.
          months: adjustMonthlyFlows(
            finance.months,
            reconcileTransferPairs(finance.recentFlows).pairs,
          ),
        }
      : null,
    career,
    lastRun,
  };
}

/**
 * Evaluate every active goal against real data: a scheduled pass over the
 * caller's own goals, evidence assembled from their finance and career rows.
 * Delivery intents are recorded, never sent.
 */
export async function runEvaluation(
  userId: string,
  options: { slot?: ProactivityDependencies['slot']; trigger?: ProactivityTrigger } = {},
): Promise<EvaluationRun> {
  const trigger: ProactivityTrigger = options.trigger ?? {
    kind: 'scheduled-pass',
    id: `manual-${Date.now()}`,
    ownerId: userId,
    asOf: new Date().toISOString(),
  };
  if (trigger.ownerId !== userId) {
    throw new Error('Proactivity trigger owner does not match the evaluated owner.');
  }
  // Replay before loading anything: a repeat of the same trigger is served from
  // the journal instead of re-reading the owner's data.
  const stored = await postgresJournal.find(userId, trigger.id);
  if (stored) return stored;
  // The whole pass is stamped as of the trigger, so a scheduled sweep is
  // reproducible and a manual run's record matches the instant it names.
  const asOf = trigger.kind === 'critical-change' ? trigger.occurredAt : trigger.asOf;
  const [goalRows, finance, career] = await Promise.all([
    GoalsRepository.listByOwner(db, { userId }),
    loadFinance(userId),
    loadCareer(userId),
  ]);
  const covered = (domain: string): boolean =>
    domain === 'finance' ? finance !== null : domain === 'career' ? career !== null : false;
  const goals: Goal[] = goalRows
    .filter((row) => row.status === 'active' && row.domains.some(covered))
    .map((row) => ({
      id: row.id,
      ownerId: row.ownerUserId,
      title: row.title,
      status: row.status,
      domains: row.domains,
    }));

  const slot =
    options.slot ??
    createOpenRouterProactivitySlot({
      model: process.env.PROACTIVITY_MODEL ?? 'openai/gpt-5-mini',
    });
  const engine = createProactivityEngine({
    goals: { list: async () => goals },
    contexts: createDomainContextAssembler({
      ...(finance
        ? {
            finance: createFinanceContextLoader({
              ownerId: userId,
              ...finance,
              source: 'hominem database',
            }),
          }
        : {}),
      ...(career
        ? {
            career: createCareerContextLoader({
              lastApplicationDate: career.lastApplicationDate ?? '2025-01-01',
              totalApplications: career.totalApplications,
              applicationsLast120Days: career.applicationsLast120Days,
              source: 'hominem database',
            }),
          }
        : {}),
    }),
    slot,
    deliveryPolicy: {
      plan: async ({ outcomes }): Promise<DeliveryIntent[]> =>
        outcomes.flatMap(({ context, decision }: GoalOutcome) =>
          decision.kind === 'propose'
            ? [
                {
                  kind: 'goal-proposal' as const,
                  idempotencyKey: `${context.trigger.id}:${context.goal.id}`,
                  ownerId: context.goal.ownerId,
                  goalId: context.goal.id,
                  channel: 'email' as const,
                  subject: decision.summary,
                  body: `${decision.reason}\n\nNext step: ${decision.nextStep}`,
                  sendAt: asOf,
                },
              ]
            : [],
        ),
    },
    journal: postgresJournal,
    clock: { now: () => asOf },
  });

  const run = await engine.run(trigger);
  return run;
}
