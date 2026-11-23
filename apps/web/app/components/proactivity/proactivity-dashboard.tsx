import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Chip, PageHeader, SectionCard, Stat } from '~/components/design';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

const DECISION_TONE: Record<string, string> = {
  propose: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  defer: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  quiet: 'text-muted-foreground',
};

const GOAL_STATE_TONE: Record<string, string> = {
  attention: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  waiting: 'text-muted-foreground',
  'on-track': 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  unchecked: 'text-muted-foreground',
};

const EVENT_STATUS_LABEL: Record<string, string> = {
  pending: 'not run yet',
  done: 'evaluated',
  error: 'failed',
};

export function ProactivityDashboard() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState(false);

  const studioQuery = useQuery({
    queryKey: ['proactivity', 'studio'],
    queryFn: async () => (await client.api.proactivity.studio.$get()).json(),
  });

  function setView(view: NonNullable<typeof studioQuery.data>) {
    queryClient.setQueryData(['proactivity', 'studio'], view);
  }

  const runEvent = useMutation({
    mutationFn: async (eventId: string) =>
      (await client.api.proactivity.run.$post({ json: { eventId } })).json(),
    onSuccess: setView,
  });

  const inject = useMutation({
    mutationFn: async (presetId: string) =>
      (await client.api.proactivity.inject.$post({ json: { presetId } })).json(),
    onSuccess: (result) => setView(result.view),
  });

  const reset = useMutation({
    mutationFn: async () => (await client.api.proactivity.reset.$post()).json(),
    onSuccess: setView,
  });

  if (studioQuery.isPending) {
    return <p className="p-6 text-sm text-muted-foreground">Loading the engine's week…</p>;
  }
  if (studioQuery.isError) {
    return (
      <p className="p-6 text-sm text-destructive">
        Could not load the proactivity studio: {String(studioQuery.error)}
      </p>
    );
  }

  const view = studioQuery.data;
  const pending = view.events.filter((event) => event.status === 'pending');

  async function playPending() {
    setPlaying(true);
    try {
      for (const event of pending) {
        await runEvent.mutateAsync(event.id);
      }
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        eyebrow="Proactivity engine"
        title="The week, evaluated"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                playPending();
              }}
              disabled={playing || pending.length === 0}
            >
              {playing ? 'Playing…' : `Run ${pending.length} pending`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              Reset
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          {view.weekLabel}
        </span>
        <Chip className={view.modelReady ? DECISION_TONE.propose : DECISION_TONE.defer}>
          {view.modelReady ? `model ready · ${view.model}` : 'no model key — preflight only'}
        </Chip>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="proposals" value={String(view.stats.proposals)} sub="propose decisions" />
        <Stat label="deferred" value={String(view.stats.deferred)} sub="waited, no spam" />
        <Stat label="checks" value={String(view.stats.checks)} sub="evaluations" />
        <Stat
          label="model calls"
          value={String(view.stats.modelCalls)}
          sub={`avg ${Math.round(view.stats.averageLatencyMs)}ms`}
        />
      </div>

      <div className="mb-6">
        <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Goals
        </p>
        <div className="flex flex-wrap gap-2">
          {view.goals.map((goal) => (
            <Chip key={goal.id} className={GOAL_STATE_TONE[goal.state]}>
              {goal.title} · {goal.state}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
          Feed
        </p>
        <div className="flex flex-wrap gap-2">
          {inject.isPending ? (
            <span className="text-xs text-muted-foreground">injecting…</span>
          ) : null}
          {view.presets.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              size="xs"
              title={preset.hint}
              onClick={() => inject.mutate(preset.id)}
              disabled={inject.isPending}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {view.events.map((event, index) => (
          <SectionCard key={event.id} index={index}>
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    {event.at.slice(11, 16)} · {event.domainLabel} · {event.sourceLabel}
                  </span>
                  {event.injected ? <Chip className="py-0 text-[10px]">injected</Chip> : null}
                </div>
                <h3 className="mt-1 text-sm font-semibold">{event.title}</h3>
                <p className="text-sm text-muted-foreground">{event.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-[0.14em] uppercase',
                    event.status === 'error' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {EVENT_STATUS_LABEL[event.status] ?? event.status}
                </span>
                {event.status === 'pending' ? (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => runEvent.mutate(event.id)}
                    disabled={playing || runEvent.isPending}
                  >
                    Evaluate
                  </Button>
                ) : null}
              </div>
            </div>

            {event.results.length > 0 ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {event.results.map((result) => (
                  <div key={result.id} className="hairline rounded-sm bg-background/40 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{result.goalTitle}</span>
                      <Chip className={cn('py-0 text-[10px]', DECISION_TONE[result.decision.kind])}>
                        {result.decision.kind}
                      </Chip>
                    </div>
                    <p className="text-sm font-medium">
                      {result.decision.kind === 'propose'
                        ? result.decision.summary
                        : result.decision.reason}
                    </p>
                    {result.decision.kind === 'propose' ? (
                      <>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {result.decision.reason}
                        </p>
                        <p className="mt-2 border-l-2 border-emerald-400/40 pl-2 text-xs">
                          <span className="font-mono text-[10px] tracking-[0.14em] text-emerald-300 uppercase">
                            next step
                          </span>
                          <br />
                          {result.decision.nextStep}
                        </p>
                      </>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {result.decision.evidenceIds.map((id) => (
                        <Chip key={id} className="py-0 font-mono text-[10px]">
                          {id}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                      {result.source} · {result.latencyMs}ms{result.held ? ' · held' : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 pt-2 text-xs text-muted-foreground">
                Nothing evaluated for this event yet.
              </p>
            )}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
