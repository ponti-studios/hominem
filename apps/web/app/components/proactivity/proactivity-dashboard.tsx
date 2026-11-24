import { useApiClient } from '@hominem/rpc/react';
import type { ProactivityOverview } from '@hominem/rpc/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { BlockSkeleton } from '~/components/design';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

import {
  ProactivitySuggestion,
  type SuggestionModel,
  type SuggestionState,
} from './proactivity-suggestion';

type Evaluation = NonNullable<ProactivityOverview['lastRun']>['evaluations'][number];
type Filter = 'all' | 'finance' | 'career';

const OVERVIEW_KEY = ['proactivity', 'overview'] as const;
const DAY_MS = 86_400_000;

const formatRunTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
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

/** Mirrors the api's task due time so the review shows the real date. */
function nextMorning(): string {
  const due = new Date(Date.now() + DAY_MS);
  due.setUTCHours(9, 0, 0, 0);
  return due.toISOString();
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
      kind: 'task.create' | 'goal.pause' | 'finding.snooze';
      triggerId: string;
    }) => {
      const response = await client.api.proactivity.actions.$post({
        json: { triggerId: input.triggerId, goalId: input.goalId, kind: input.kind },
      });
      return response.json();
    },
    onSuccess: updateActions,
  });

  const undoAction = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await client.api.proactivity.actions[':id'].undo.$post({
        param: { id: actionId },
      });
      return response.json();
    },
    onSuccess: updateActions,
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

  function suggestionFor(evaluation: Evaluation): {
    suggestion: SuggestionModel;
    state: SuggestionState;
    actionId?: string;
  } {
    const goal = goalById.get(evaluation.goalId);
    const decision = evaluation.decision;
    const isProposal = decision.kind === 'propose';
    const state = stateFor(evaluation, overview.actions);
    const action = state.task ?? state.paused ?? state.snoozed;

    return {
      actionId: action?.id,
      state: state.done
        ? 'applied'
        : state.snoozed
          ? 'snoozed'
          : isProposal
            ? 'needs-you'
            : 'waiting',
      suggestion: {
        goalTitle: goal?.title ?? 'Goal',
        summary: isProposal ? decision.summary : 'Nothing new to judge yet.',
        reason: decision.reason,
        review: isProposal
          ? { kind: 'task', title: decision.nextStep, dueAt: nextMorning() }
          : { kind: 'goal.pause' },
        preparedCharges:
          isProposal && goal?.domains.includes('finance') ? overview.preparedCharges : undefined,
        appliedLabel: state.task
          ? 'Done — added to your tasks, due tomorrow.'
          : state.paused
            ? 'Done — this goal is paused. Resume it anytime.'
            : undefined,
        snoozedUntil: state.snoozed?.until ?? undefined,
      },
    };
  }

  function renderSuggestion(evaluation: Evaluation, index: number) {
    if (!lastRun) return null;
    const { suggestion, state, actionId } = suggestionFor(evaluation);
    const isProposal = evaluation.decision.kind === 'propose';

    return (
      <ProactivitySuggestion
        busy={applyAction.isPending || undoAction.isPending}
        defaultOpen={index === 0}
        key={evaluation.goalId}
        onApply={() =>
          applyAction.mutate({
            goalId: evaluation.goalId,
            kind: isProposal ? 'task.create' : 'goal.pause',
            triggerId: lastRun.triggerId,
          })
        }
        onSnooze={() =>
          applyAction.mutate({
            goalId: evaluation.goalId,
            kind: 'finding.snooze',
            triggerId: lastRun.triggerId,
          })
        }
        onUndo={actionId ? () => undoAction.mutate(actionId) : undefined}
        state={state}
        suggestion={suggestion}
      />
    );
  }

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

      <div className="mt-8 flex gap-7 border-b border-border">
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
              <div className="flex items-baseline justify-between border-b border-border pb-2.5 font-mono text-[10px] tracking-[0.17em] text-muted-foreground uppercase">
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
              {proposing.map(renderSuggestion)}
            </section>
          ) : null}

          {waiting.length > 0 ? (
            <section aria-labelledby="waiting-label" className="mt-10">
              <div className="flex items-baseline justify-between border-b border-border pb-2.5 font-mono text-[10px] tracking-[0.17em] text-muted-foreground uppercase">
                <span id="waiting-label">Waiting</span>
                <span>{waiting.length}</span>
              </div>
              {waiting.map((evaluation, index) =>
                renderSuggestion(evaluation, index + proposing.length),
              )}
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-12 border-t border-border pt-4 font-mono text-[10.5px] leading-relaxed tracking-[0.03em] text-muted-foreground">
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
