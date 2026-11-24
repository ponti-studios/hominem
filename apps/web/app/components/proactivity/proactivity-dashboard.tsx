import { useApiClient } from '@hominem/rpc/react';
import type {
  ProactivityActionKind,
  ProactivityOverview,
  ProactivityPreparedCharge,
} from '@hominem/rpc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { BlockSkeleton } from '~/components/design';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

type Evaluation = NonNullable<ProactivityOverview['lastRun']>['evaluations'][number];
type Goal = ProactivityOverview['goals'][number];
type Filter = 'all' | 'finance' | 'career';

const OVERVIEW_KEY = ['proactivity', 'overview'] as const;

const formatRunTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const formatGbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function runLabel(triggerId: string): string {
  if (triggerId.startsWith('scheduled-')) return 'scheduled pass';
  if (triggerId.startsWith('manual-')) return 'manual run';
  return 'run';
}

function stateFor(evaluation: Evaluation, actions: ProactivityOverview['actions']) {
  const open = actions.filter(
    (action) => action.goalId === evaluation.goalId && action.status === 'applied',
  );
  const task = open.find((action) => action.kind === 'task.create');
  const paused = open.find((action) => action.kind === 'goal.pause');
  const snoozed = open.find(
    (action) =>
      action.kind === 'finding.snooze' && action.until && Date.parse(action.until) > Date.now(),
  );
  return { task, paused, snoozed, done: Boolean(task || paused) };
}

function Awaiting({
  children,
  tone = 'done',
}: {
  children: React.ReactNode;
  tone?: 'done' | 'quiet';
}) {
  return (
    <div
      className={cn(
        'mt-4 flex items-center gap-2.5 rounded-sm px-3.5 py-2.5 text-[13px]',
        tone === 'done'
          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground',
      )}
    >
      <CheckGlyph />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M6.4 10.2l2.4 2.4 4.8-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function FilterTab({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        '-mb-px border-b pb-3 font-mono text-[10px] tracking-[0.15em] uppercase transition-colors',
        active
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground/80',
      )}
      onClick={onClick}
      type="button"
    >
      {label} <span className="ml-1 text-muted-foreground">{count}</span>
    </button>
  );
}

export function ProactivityDashboard() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [confirming, setConfirming] = useState<{
    goalId: string;
    kind: ProactivityActionKind;
  } | null>(null);
  const [preparedFor, setPreparedFor] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: async () => (await client.api.proactivity.overview.$get()).json(),
  });

  const updateActions = (action: ProactivityOverview['actions'][number]) => {
    queryClient.setQueryData<ProactivityOverview>(OVERVIEW_KEY, (current) =>
      current
        ? {
            ...current,
            actions: [...current.actions.filter((row) => row.id !== action.id), action],
          }
        : current,
    );
  };

  const applyAction = useMutation({
    mutationFn: async (input: {
      goalId: string;
      kind: ProactivityActionKind;
      triggerId: string;
    }) => {
      const response = await client.api.proactivity.actions.$post({
        json: { triggerId: input.triggerId, goalId: input.goalId, kind: input.kind },
      });
      return response.json();
    },
    onSuccess: (action) => {
      updateActions(action);
      setConfirming(null);
    },
  });

  const undoAction = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await client.api.proactivity.actions[':id'].undo.$post({
        param: { id: actionId },
      });
      return response.json();
    },
    onSuccess: (action) => updateActions(action),
  });

  const run = useMutation({
    mutationFn: async () => (await client.api.proactivity.run.$post()).json(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
  });

  if (overviewQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-6 py-12">
        <BlockSkeleton className="h-9 w-44" />
        <BlockSkeleton className="h-16" />
        <BlockSkeleton className="h-28" />
        <BlockSkeleton className="h-28" />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-destructive">Could not load your findings.</p>
        <Button
          className="mt-4"
          onClick={() => overviewQuery.refetch()}
          size="sm"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    );
  }

  const overview = overviewQuery.data;
  const lastRun = overview.lastRun;
  const goalById = new Map(overview.goals.map((goal) => [goal.id, goal]));
  const evaluations = lastRun?.evaluations ?? [];
  const visible = evaluations.filter((evaluation) => {
    if (evaluation.decision.kind === 'quiet') return false;
    if (filter === 'all') return true;
    const goal = goalById.get(evaluation.goalId);
    return goal?.domains.includes(filter) ?? false;
  });
  const proposing = visible.filter((evaluation) => evaluation.decision.kind === 'propose');
  const waiting = visible.filter((evaluation) => evaluation.decision.kind === 'defer');

  const needsCount = evaluations.filter((evaluation) => {
    if (evaluation.decision.kind !== 'propose') return false;
    const state = stateFor(evaluation, overview.actions);
    return !state.done && !state.snoozed;
  }).length;

  const counts = {
    all: evaluations.filter((evaluation) => evaluation.decision.kind !== 'quiet').length,
    finance: evaluations.filter(
      (evaluation) =>
        evaluation.decision.kind !== 'quiet' &&
        (goalById.get(evaluation.goalId)?.domains.includes('finance') ?? false),
    ).length,
    career: evaluations.filter(
      (evaluation) =>
        evaluation.decision.kind !== 'quiet' &&
        (goalById.get(evaluation.goalId)?.domains.includes('career') ?? false),
    ).length,
  };

  const checked = lastRun
    ? `${relativeTime(lastRun.processedAt)} · ${runLabel(lastRun.triggerId)}`
    : 'not yet';

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Proactivity
          </p>
          <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            Findings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {needsCount > 0 ? (
              <>
                <span className="font-semibold text-foreground">{needsCount}</span>{' '}
                {needsCount === 1 ? 'needs' : 'need'} a decision.{' '}
              </>
            ) : (
              <span className="font-semibold text-foreground">Nothing needs you right now. </span>
            )}
            Checked {checked}.
          </p>
        </div>
        <Button disabled={run.isPending} onClick={() => run.mutate()} size="sm" variant="ghost">
          {run.isPending ? 'Checking…' : 'Check again'}
        </Button>
      </header>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm bg-muted px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
        <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase">What I can do</span>
        <span>
          I can pause a goal, add a task and prepare a list of charges.{' '}
          <span className="font-medium text-foreground">
            I can&rsquo;t move money or cancel anything.
          </span>
        </span>
      </p>

      <div className="mt-8 flex gap-7 border-b border-[var(--border-default)]">
        <FilterTab
          active={filter === 'all'}
          count={counts.all}
          label="All"
          onClick={() => setFilter('all')}
        />
        <FilterTab
          active={filter === 'finance'}
          count={counts.finance}
          label="Finance"
          onClick={() => setFilter('finance')}
        />
        <FilterTab
          active={filter === 'career'}
          count={counts.career}
          label="Career"
          onClick={() => setFilter('career')}
        />
      </div>

      {!lastRun ? (
        <div className="py-14">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">Nothing checked yet.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your goals are ready. Run a check and I&rsquo;ll only come back if something needs you.
          </p>
          <Button className="mt-4" disabled={run.isPending} onClick={() => run.mutate()} size="sm">
            {run.isPending ? 'Checking…' : 'Check now'}
          </Button>
        </div>
      ) : proposing.length === 0 && waiting.length === 0 ? (
        <div className="py-14">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">Nothing needs you.</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Everything you asked me to watch is handled or quietly on track. I&rsquo;ll come back
            when something changes.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          {proposing.length > 0 ? (
            <section aria-labelledby="needs-label" className="mt-6">
              <div className="flex items-baseline justify-between border-b border-[var(--border-default)] pb-2.5 font-mono text-[10px] tracking-[0.17em] text-muted-foreground uppercase">
                <span id="needs-label">Needs you</span>
                <span>
                  {
                    proposing.filter((evaluation) => {
                      const state = stateFor(evaluation, overview.actions);
                      return !state.done && !state.snoozed;
                    }).length
                  }
                </span>
              </div>
              {proposing.map((evaluation, index) => {
                const goal = goalById.get(evaluation.goalId);
                if (!goal) return null;
                return (
                  <FindingRow
                    key={evaluation.goalId}
                    actions={overview.actions}
                    confirming={confirming}
                    evaluation={evaluation}
                    goal={goal}
                    index={index}
                    isApplying={applyAction.isPending}
                    isUndoing={undoAction.isPending}
                    onApply={(kind) => {
                      applyAction.mutate({
                        goalId: evaluation.goalId,
                        kind,
                        triggerId: lastRun.triggerId,
                      });
                    }}
                    onConfirm={setConfirming}
                    onPrepare={() => setPreparedFor(evaluation.goalId)}
                    onUndo={(actionId) => undoAction.mutate(actionId)}
                    preparedCharges={overview.preparedCharges}
                    preparedOpen={preparedFor === evaluation.goalId}
                  />
                );
              })}
            </section>
          ) : null}

          {waiting.length > 0 ? (
            <section aria-labelledby="waiting-label" className="mt-10">
              <div className="flex items-baseline justify-between border-b border-[var(--border-default)] pb-2.5 font-mono text-[10px] tracking-[0.17em] text-muted-foreground uppercase">
                <span id="waiting-label">Waiting</span>
                <span>{waiting.length}</span>
              </div>
              {waiting.map((evaluation, index) => {
                const goal = goalById.get(evaluation.goalId);
                if (!goal) return null;
                return (
                  <FindingRow
                    key={evaluation.goalId}
                    actions={overview.actions}
                    confirming={confirming}
                    evaluation={evaluation}
                    goal={goal}
                    index={index + proposing.length}
                    isApplying={applyAction.isPending}
                    isUndoing={undoAction.isPending}
                    onApply={(kind) => {
                      applyAction.mutate({
                        goalId: evaluation.goalId,
                        kind,
                        triggerId: lastRun.triggerId,
                      });
                    }}
                    onConfirm={setConfirming}
                    onPrepare={() => setPreparedFor(evaluation.goalId)}
                    onUndo={(actionId) => undoAction.mutate(actionId)}
                    preparedCharges={[]}
                    preparedOpen={false}
                  />
                );
              })}
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-12 border-t border-[var(--border-default)] pt-4 font-mono text-[10.5px] leading-relaxed tracking-[0.03em] text-muted-foreground">
        {lastRun ? (
          <>
            Checked {formatRunTime.format(new Date(lastRun.processedAt))} ·{' '}
            {runLabel(lastRun.triggerId)} · {evaluations.length} goals evaluated
            <br />
          </>
        ) : null}
        Every action is reversible and recorded against the finding that offered it.
      </p>
    </div>
  );
}

function FindingRow({
  actions,
  confirming,
  evaluation,
  goal,
  index,
  isApplying,
  isUndoing,
  onApply,
  onConfirm,
  onPrepare,
  onUndo,
  preparedCharges,
  preparedOpen,
}: {
  actions: ProactivityOverview['actions'];
  confirming: { goalId: string; kind: ProactivityActionKind } | null;
  evaluation: Evaluation;
  goal: Goal;
  index: number;
  isApplying: boolean;
  isUndoing: boolean;
  onApply: (kind: ProactivityActionKind) => void;
  onConfirm: (value: { goalId: string; kind: ProactivityActionKind } | null) => void;
  onPrepare: () => void;
  onUndo: (actionId: string) => void;
  preparedCharges: ProactivityPreparedCharge[];
  preparedOpen: boolean;
}) {
  const decision = evaluation.decision;
  const state = stateFor(evaluation, actions);
  const isProposal = decision.kind === 'propose';
  const needsConfirm = confirming?.goalId === evaluation.goalId && confirming.kind === 'goal.pause';
  const stateLabel = state.done
    ? 'Done'
    : state.snoozed
      ? `Snoozed until ${formatDay.format(new Date(state.snoozed.until!))}`
      : isProposal
        ? 'Needs you'
        : 'Waiting';
  const stateTone = state.done
    ? 'text-emerald-700 dark:text-emerald-400'
    : state.snoozed || !isProposal
      ? 'text-muted-foreground'
      : 'text-amber-700 dark:text-amber-400';

  const canPrepare = isProposal && preparedCharges.length > 0;

  return (
    <details
      className="group border-b border-[var(--border-default)]"
      ref={(element) => {
        // Open the first finding once, then leave the row uncontrolled so
        // applying an action cannot snap it shut.
        if (element && index === 0 && element.dataset.initialised !== 'true') {
          element.dataset.initialised = 'true';
          element.open = true;
        }
      }}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.13em] text-muted-foreground uppercase">
            {goal.title}
          </p>
          <p className="mt-1.5 max-w-[46ch] text-[17px] leading-snug font-semibold tracking-[-0.008em]">
            {isProposal ? decision.summary : 'Nothing new to judge yet.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          <span className={cn('font-mono text-[9.5px] tracking-[0.13em] uppercase', stateTone)}>
            {stateLabel}
          </span>
          <span className="grid size-5 place-items-center rounded-full border border-[var(--border-strong,var(--border-default))] text-xs text-muted-foreground transition-transform group-open:rotate-45">
            +
          </span>
        </div>
      </summary>

      <div className="max-w-[62ch] pb-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{decision.reason}</p>

        {state.done ? (
          <Awaiting>
            {state.task
              ? 'Added to your tasks, due tomorrow.'
              : 'This goal is paused. Nothing is lost; resume it anytime.'}
            <button
              className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
              disabled={isUndoing}
              onClick={() => onUndo((state.task ?? state.paused)!.id)}
              type="button"
            >
              Undo
            </button>
          </Awaiting>
        ) : state.snoozed ? (
          <Awaiting tone="quiet">
            Snoozed until {formatDay.format(new Date(state.snoozed.until!))}. I&rsquo;ll only come
            back sooner if this changes materially.
            <button
              className="shrink-0 font-semibold underline underline-offset-2 disabled:opacity-50"
              disabled={isUndoing}
              onClick={() => onUndo(state.snoozed!.id)}
              type="button"
            >
              Undo
            </button>
          </Awaiting>
        ) : (
          <div className="mt-4 overflow-hidden rounded-sm border border-[var(--border-default)]">
            <div className="border-b border-[var(--border-default)] px-4 py-2.5 font-mono text-[9.5px] tracking-[0.14em] text-muted-foreground uppercase">
              Do it for me
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[14.5px] leading-snug font-semibold">
                {isProposal
                  ? 'Turn the next step into a task.'
                  : 'Pause this goal while there is nothing to act on.'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {isProposal
                  ? `I'll add "${decision.nextStep}" to your tasks, due tomorrow. You can undo it.`
                  : 'I will stop checking this goal until you resume it. The goal and its history stay as they are.'}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {isProposal ? (
                  <Button disabled={isApplying} onClick={() => onApply('task.create')} size="sm">
                    {isApplying ? 'Adding…' : 'Add to tasks'}
                  </Button>
                ) : null}
                <Button
                  disabled={isApplying}
                  onClick={() => onConfirm({ goalId: evaluation.goalId, kind: 'goal.pause' })}
                  size="sm"
                  variant="outline"
                >
                  Pause this goal
                </Button>
                <Button
                  disabled={isApplying}
                  onClick={() => onApply('finding.snooze')}
                  size="sm"
                  variant="ghost"
                >
                  Not now
                </Button>
                {canPrepare ? (
                  <Button className="ml-auto" onClick={onPrepare} size="sm" variant="outline">
                    {preparedOpen ? 'Charges shown' : 'Show the charges'}
                  </Button>
                ) : null}
              </div>

              {needsConfirm ? (
                <div className="mt-4 border-t border-[var(--border-default)] pt-3.5">
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    This pauses <span className="font-medium text-foreground">{goal.title}</span>{' '}
                    until you resume it. Nothing is deleted, and you can undo it.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button disabled={isApplying} onClick={() => onApply('goal.pause')} size="sm">
                      Yes, pause it
                    </Button>
                    <Button onClick={() => onConfirm(null)} size="sm" variant="outline">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {canPrepare && preparedOpen ? (
                <div className="mt-4 border-t border-[var(--border-default)] pt-3">
                  <ul className="space-y-0">
                    {preparedCharges.map((charge) => (
                      <li
                        className="flex items-baseline justify-between gap-4 border-b border-[var(--border-default)] py-2 text-[13px] text-muted-foreground last:border-0"
                        key={charge.merchant}
                      >
                        <span>
                          {charge.merchant}
                          {charge.charges > 1 ? ` · ${charge.charges} charges` : ''}
                        </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatGbp.format(charge.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    November&rsquo;s largest non-transfer charges. Nothing is cancelled or
                    contacted.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
