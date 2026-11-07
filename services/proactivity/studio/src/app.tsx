import { useEffect, useMemo, useState } from 'react';

import {
  acceptProposal,
  clearPreference,
  fetchStudio,
  injectShock,
  resetStudio,
  runEvent,
  setActionStatus,
  setPreference,
} from './api';
import { Feed } from './components/feed';
import { Inspector, type InspectTab } from './components/inspector';
import { Rail } from './components/rail';
import { SidePanel } from './components/side-panel';
import { Topbar } from './components/topbar';
import { WeekStrip } from './components/week-strip';
import { formatDateLong, IconPlay, IconRefresh, plural } from './format';
import type { StudioResult, StudioView } from './types';

export function App() {
  const [view, setView] = useState<StudioView | null>(null);
  const [selectedDay, setSelectedDay] = useState(3);
  const [goalFilter, setGoalFilter] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ resultId: string; tab: InspectTab } | null>(null);
  const [runningEventId, setRunningEventId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(
    null,
  );
  const [injecting, setInjecting] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStudio()
      .then((next) => {
        if (cancelled) return;
        setView(next);
        setSelectedDay(next.storyDayIndex);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(messageOf(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dayEvents = useMemo(() => {
    if (!view) return [];
    return view.events.filter(
      (event) =>
        event.dayIndex === selectedDay && (!goalFilter || event.goalIds.includes(goalFilter)),
    );
  }, [view, selectedDay, goalFilter]);

  const day = view?.days[selectedDay];
  const dayResults = dayEvents.flatMap((event) =>
    event.results.filter((result) => !goalFilter || result.goalId === goalFilter),
  );
  const actionedKeys = new Set(
    (view?.actions ?? []).map((action) => `${action.eventId}:${action.goalId}`),
  );
  const proposals = dayResults.filter(
    (result) =>
      result.decision.kind === 'propose' &&
      !result.held &&
      !actionedKeys.has(`${result.eventId}:${result.goalId}`),
  );
  const held = dayResults.filter((result) => result.held);
  const avoided = dayResults.filter(
    (result) => result.decision.kind === 'defer' || result.decision.kind === 'quiet',
  ).length;
  const pending = dayEvents.filter(
    (event) => event.status === 'pending' || event.status === 'error',
  ).length;
  const checked = dayResults.length;
  const weekPending = view
    ? view.events.filter((event) => event.status === 'pending' || event.status === 'error').length
    : 0;
  const running = Boolean(progress) || busy;

  const inspectResult = view && inspect ? findResult(view, inspect.resultId) : null;
  const inspectEvent = inspectResult
    ? (view?.events.find((event) => event.id === inspectResult.eventId) ?? null)
    : null;
  const inspectedActioned = Boolean(
    inspectResult &&
    view?.actions.some(
      (action) =>
        action.status === 'open' &&
        action.eventId === inspectResult.eventId &&
        action.goalId === inspectResult.goalId,
    ),
  );

  if (!view || !day) {
    return (
      <div className="loading">
        <span className="brand">hominem</span>
        <p>{error ?? 'Opening the week…'}</p>
        {error ? (
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  const headline = buildHeadline({ checked, proposals: proposals.length, pending, day });
  const sub = buildSub({
    checked,
    proposals: proposals.length,
    pending,
    avoided,
    held: held.length,
    day,
  });

  async function refresh(action: () => Promise<StudioView>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      setView(await action());
      if (success) setToast(success);
    } catch (actionError) {
      setError(messageOf(actionError));
    } finally {
      setBusy(false);
    }
  }

  async function handleRunEvent(eventId: string) {
    setRunningEventId(eventId);
    setError(null);
    try {
      setView(await runEvent(eventId));
    } catch (runError) {
      setError(messageOf(runError));
    } finally {
      setRunningEventId(null);
    }
  }

  async function handleRunDay() {
    const queue = dayEvents.filter(
      (event) => event.status === 'pending' || event.status === 'error',
    );
    if (queue.length === 0) return;
    await runQueue(
      queue.map((event) => event.id),
      day?.isFuture ? 'Running ahead' : 'Checking the day',
    );
  }

  async function handleRunWeek() {
    const queue = view?.events
      .filter((event) => event.status === 'pending' || event.status === 'error')
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    if (!queue || queue.length === 0) return;
    await runQueue(
      queue.map((event) => event.id),
      'Playing the week',
    );
    if (view) setSelectedDay(view.storyDayIndex);
  }

  async function runQueue(ids: string[], label: string) {
    setError(null);
    setProgress({ done: 0, total: ids.length, label });
    try {
      for (const [index, id] of ids.entries()) {
        setRunningEventId(id);
        setProgress({ done: index, total: ids.length, label });
        const next = await runEvent(id);
        setView(next);
      }
      setProgress({ done: ids.length, total: ids.length, label });
      setToast(`${ids.length} ${plural(ids.length, 'check')} complete.`);
    } catch (runError) {
      setError(messageOf(runError));
    } finally {
      setRunningEventId(null);
      window.setTimeout(() => setProgress(null), 400);
    }
  }

  async function handleInject(presetId: string) {
    setInjecting(presetId);
    setError(null);
    try {
      const result = await injectShock(presetId);
      setView(result.view);
      setSelectedDay(result.view.storyDayIndex);
      setGoalFilter(null);
      const injected = result.view.events.find((event) => event.id === result.eventId);
      const first = injected?.results[0];
      if (first) setInspect({ resultId: first.id, tab: 'decision' });
      setToast('Injected. The engine just decided.');
    } catch (injectError) {
      setError(messageOf(injectError));
    } finally {
      setInjecting(null);
    }
  }

  async function handleAccept(result: StudioResult) {
    setBusy(true);
    setError(null);
    try {
      const next = await acceptProposal(result.id);
      setView(next.view);
      setToast('Added to your plan.');
    } catch (acceptError) {
      setError(messageOf(acceptError));
    } finally {
      setBusy(false);
    }
  }

  async function handleResume(goalId: string) {
    await refresh(() => clearPreference(goalId), 'Delivery resumed.');
  }

  async function handleRerun() {
    if (!inspectResult) return;
    setRerunning(true);
    setError(null);
    try {
      setView(await runEvent(inspectResult.eventId, true));
      setToast('Fresh run complete.');
    } catch (runError) {
      setError(messageOf(runError));
    } finally {
      setRerunning(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('Clear every run, preference, and plan item?')) return;
    setBusy(true);
    setError(null);
    try {
      const next = await resetStudio();
      setView(next);
      setSelectedDay(next.storyDayIndex);
      setGoalFilter(null);
      setInspect(null);
      setToast('The week is reset.');
    } catch (resetError) {
      setError(messageOf(resetError));
    } finally {
      setBusy(false);
    }
  }

  function handleToday() {
    setSelectedDay(view?.storyDayIndex ?? 3);
    setGoalFilter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNavigate(target: 'plan' | 'ledger') {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <Topbar view={view} onToday={handleToday} onNavigate={handleNavigate} />
      {error ? (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="shell">
        <Rail
          view={view}
          selectedDay={selectedDay}
          selectedGoal={goalFilter}
          onSelectDay={setSelectedDay}
          onSelectGoal={setGoalFilter}
          onToggleAction={(id, status) => refresh(() => setActionStatus(id, status))}
          onResume={(goalId) => handleResume(goalId)}
        />

        <main className="main">
          <div className="mobile-week">
            <p className="eyebrow">This week</p>
            <WeekStrip days={view.days} selected={selectedDay} onSelect={setSelectedDay} />
          </div>
          <header className="hero">
            <div className="hero-meta">
              <span>{formatDateLong(day.date)}</span>
              <span className="hero-week">Week of {view.weekLabel}</span>
            </div>
            <h1>{headline}</h1>
            <p className="hero-sub">{sub}</p>
            {goalFilter ? (
              <div className="filter-chip">
                <span>
                  Showing {view.goals.find((goal) => goal.id === goalFilter)?.title ?? 'one goal'}
                </span>
                <button type="button" onClick={() => setGoalFilter(null)}>
                  Clear filter
                </button>
              </div>
            ) : null}
            <div className="hero-actions">
              <button
                type="button"
                className="btn"
                onClick={() => handleRunDay()}
                disabled={pending === 0 || running}
                title="Runs a live check for each affected goal on this day."
              >
                <IconPlay size={12} />
                {pending === 0
                  ? 'Everything checked'
                  : day.isFuture
                    ? 'Run ahead'
                    : 'Run the checks'}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => handleRunWeek()}
                disabled={weekPending === 0 || running}
                title="Runs the remaining checks in order. Each affected goal is a live model call."
              >
                <IconRefresh size={12} />
                Play the week
              </button>
            </div>
            {progress ? (
              <div className="progress" aria-live="polite">
                <span>
                  {progress.label} · {progress.done}/{progress.total}
                </span>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${progress.total === 0 ? 0 : (progress.done / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </header>

          <Feed
            view={view}
            events={dayEvents}
            goalFilter={goalFilter}
            runningEventId={runningEventId}
            onRun={(eventId) => handleRunEvent(eventId)}
            onInspect={(result, tab = 'decision') => setInspect({ resultId: result.id, tab })}
            onAccept={(result) => handleAccept(result)}
            onSnooze={(goalId) =>
              refresh(() => setPreference(goalId, 'snooze', 3), 'Held for three days.')
            }
            onResume={(goalId) => handleResume(goalId)}
          />

          <footer className="page-foot">
            <span>{view.owner.name} · synthetic week</span>
            <span>
              {view.stats.checks} checks · {view.stats.modelCalls} live model calls
            </span>
          </footer>
        </main>

        <SidePanel
          view={view}
          injecting={injecting}
          disabled={running}
          onInject={(presetId) => handleInject(presetId)}
          onReset={() => handleReset()}
        />
      </div>

      {inspectResult && inspectEvent && inspect ? (
        <Inspector
          result={inspectResult}
          event={inspectEvent}
          actioned={inspectedActioned}
          rerunning={rerunning}
          initialTab={inspect.tab}
          onClose={() => setInspect(null)}
          onRerun={() => handleRerun()}
          onAccept={() => handleAccept(inspectResult)}
          onSnooze={() =>
            refresh(() => setPreference(inspectResult.goalId, 'snooze', 3), 'Held for three days.')
          }
          onResume={() => handleResume(inspectResult.goalId)}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function findResult(view: StudioView, resultId: string): StudioResult | null {
  for (const event of view.events) {
    const result = event.results.find((candidate) => candidate.id === resultId);
    if (result) return result;
  }
  return null;
}

function buildHeadline(input: {
  checked: number;
  proposals: number;
  pending: number;
  day: StudioView['days'][number];
}): string {
  if (input.checked === 0 && input.day.isFuture) return 'Nothing has landed yet.';
  if (input.checked === 0) return input.pending > 0 ? 'Nothing checked yet.' : 'A quiet day.';
  if (input.proposals === 0) return 'Nothing needs you.';
  if (input.proposals === 1) return 'One thing needs you.';
  const count = numberWord(input.proposals);
  return `${count[0]?.toUpperCase() ?? ''}${count.slice(1)} things need you.`;
}

function buildSub(input: {
  checked: number;
  proposals: number;
  pending: number;
  avoided: number;
  held: number;
  day: StudioView['days'][number];
}): string {
  if (input.checked === 0 && input.day.isFuture) {
    return input.pending > 0
      ? `${input.pending} upcoming ${plural(input.pending, 'signal')}. You can run ahead.`
      : 'No signals are scheduled for this day.';
  }
  if (input.checked === 0) {
    return input.pending > 0
      ? `${input.pending} ${plural(input.pending, 'signal')} ${input.pending === 1 ? 'is' : 'are'} waiting for a check.`
      : 'No signals landed on this day.';
  }
  const parts = [
    `${input.checked} ${plural(input.checked, 'check')} across the day.`,
    input.avoided > 0 ? `${input.avoided} ${plural(input.avoided, 'message')} withheld.` : '',
    input.held > 0 ? `${input.held} held by you.` : '',
    input.pending > 0 ? `${input.pending} still to check.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

function numberWord(value: number): string {
  return (
    ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][
      value
    ] ?? String(value)
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
