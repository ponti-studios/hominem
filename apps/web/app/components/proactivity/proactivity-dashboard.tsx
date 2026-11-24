import { useApiClient } from '@hominem/rpc/react';
import type { ProactivityOverview } from '@hominem/rpc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Chip, PageHeader, SectionCard, Stat } from '~/components/design';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

const DECISION_TONE: Record<string, string> = {
  propose: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  defer: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  quiet: 'text-muted-foreground',
};

const formatGbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

const formatRunTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** A run's trigger id is an idempotency key, not copy a person should read. */
function runLabel(triggerId: string): string {
  if (triggerId.startsWith('scheduled-')) return 'scheduled pass';
  if (triggerId.startsWith('manual-')) return 'manual run';
  return 'run';
}

export function ProactivityDashboard() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['proactivity', 'overview'],
    queryFn: async () => (await client.api.proactivity.overview.$get()).json(),
  });

  const run = useMutation({
    mutationFn: async () => (await client.api.proactivity.run.$post()).json(),
    onSuccess: (evaluationRun) => {
      queryClient.setQueryData<ProactivityOverview>(['proactivity', 'overview'], (current) =>
        current ? { ...current, lastRun: evaluationRun } : current,
      );
    },
  });

  if (overviewQuery.isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading your goals…</p>;
  }
  if (overviewQuery.isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load proactivity: {String(overviewQuery.error)}
      </p>
    );
  }

  const overview = overviewQuery.data;
  const lastRun = overview.lastRun;
  const activeGoals = overview.goals.filter((goal) => goal.status === 'active');
  const finance = overview.finance;
  const currentMonth = finance?.months[finance.months.length - 1];
  const previousMonth = finance?.months[finance.months.length - 2];
  const currentCategories = currentMonth
    ? finance?.categories.filter((row) => row.month === currentMonth.month).slice(0, 6)
    : [];

  function titleFor(goalId: string): string {
    return overview.goals.find((goal) => goal.id === goalId)?.title ?? goalId;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        eyebrow="Proactivity engine"
        title="Your goals, evaluated"
        actions={
          <Button
            size="sm"
            onClick={() => run.mutate()}
            disabled={run.isPending || activeGoals.length === 0}
          >
            {run.isPending ? 'Evaluating…' : 'Evaluate now'}
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Chip>
          {overview.goals.length} goals · {activeGoals.length} active
        </Chip>
        {finance ? (
          <Chip>
            finance: {finance.months.length} months · {finance.recentFlows.length} flows (6m)
          </Chip>
        ) : (
          <Chip className={DECISION_TONE.defer}>no finance data for this account</Chip>
        )}
        {overview.career ? (
          <Chip>career: last application {overview.career.lastApplicationDate ?? '—'}</Chip>
        ) : (
          <Chip className={DECISION_TONE.defer}>no career data</Chip>
        )}
        {lastRun ? (
          <Chip>last evaluated {lastRun.processedAt.slice(0, 16).replace('T', ' ')}</Chip>
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="goals" value={String(activeGoals.length)} sub="active in app.goals" />
        <Stat
          label="evaluations"
          value={String(lastRun?.evaluations.length ?? 0)}
          sub="in the last run"
        />
        <Stat
          label="proposals"
          value={String(
            lastRun?.evaluations.filter((e) => e.decision.kind === 'propose').length ?? 0,
          )}
          sub="propose decisions"
        />
        <Stat
          label="intents"
          value={String(lastRun?.deliveryIntents.length ?? 0)}
          sub="recorded, nothing sent"
        />
      </div>

      <SectionCard className="mb-4">
        <div className="p-4">
          <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Real data feeding the engine
          </p>
          {finance && currentMonth ? (
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
              {previousMonth ? (
                <span>
                  {previousMonth.month}: in {formatGbp.format(previousMonth.income)} / out{' '}
                  {formatGbp.format(previousMonth.spend)}
                </span>
              ) : null}
              <span className="text-foreground">
                {currentMonth.month}: in {formatGbp.format(currentMonth.income)} / out{' '}
                {formatGbp.format(currentMonth.spend)}
              </span>
              <span>top: {currentCategories.map((row) => row.category).join(', ') || '—'}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No finance transactions for this account, so finance goals cannot be evaluated yet.
            </p>
          )}
        </div>
      </SectionCard>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Goals
        </p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {overview.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No goals yet — there is no goal editor in the app at this point (goal lifecycle is an
            open decision in the PRD).
          </p>
        ) : (
          overview.goals.map((goal) => (
            <Chip key={goal.id}>
              {goal.title} · {goal.domains.join('/') || 'no domains'} · {goal.status}
            </Chip>
          ))
        )}
      </div>

      {lastRun ? (
        <>
          <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Decisions — {runLabel(lastRun.triggerId)} ·{' '}
            {formatRunTime.format(new Date(lastRun.processedAt))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {lastRun.evaluations.map((evaluation) => (
              <section key={evaluation.goalId} className="hairline rounded-sm bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold">
                    {titleFor(evaluation.goalId)}
                  </span>
                  <Chip className={cn('py-0 text-[10px]', DECISION_TONE[evaluation.decision.kind])}>
                    {evaluation.decision.kind}
                  </Chip>
                </div>
                {evaluation.decision.kind === 'propose' ? (
                  <>
                    <p className="text-sm font-medium">{evaluation.decision.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {evaluation.decision.reason}
                    </p>
                    <p className="mt-2 border-l-2 border-emerald-400/40 pl-2 text-xs">
                      <span className="font-mono text-[10px] tracking-[0.14em] text-emerald-300 uppercase">
                        next step
                      </span>
                      <br />
                      {evaluation.decision.nextStep}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{evaluation.decision.reason}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {evaluation.decision.evidenceIds.map((id) => (
                    <Chip key={id} className="py-0 font-mono text-[10px]">
                      {id}
                    </Chip>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {lastRun.deliveryIntents.length > 0 ? (
            <>
              <p className="mt-6 mb-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                Delivery intents (recorded, nothing sent)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {lastRun.deliveryIntents.map((intent) => (
                  <section key={intent.idempotencyKey} className="hairline rounded-sm bg-card p-3">
                    <p className="text-sm font-medium">✉ {intent.subject}</p>
                    <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{intent.body}</p>
                  </section>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No evaluation yet — press Evaluate now to run the engine against your real data.
        </p>
      )}
    </div>
  );
}
